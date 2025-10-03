from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from hmmlearn import hmm
from pydantic import BaseModel, Field, ConfigDict
from sklearn.preprocessing import StandardScaler

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_VERSION = "hmm-0.3"
DEFAULT_N_STATES = 4
MIN_TICKS_REQUIRED = 200
HOLDOUT_FRACTION = 0.15


class PolicyRequest(BaseModel):
    symbol: str
    features: List[float]
    ts: float


class PolicyResponse(BaseModel):
    state: int
    action: Optional[str]
    confidence: float


class TrainRequest(BaseModel):
    symbol: str
    date_range: Optional[List[str]] = Field(default=None, alias="dateRange")

    model_config = ConfigDict(populate_by_name=True)


class PartialFitRequest(BaseModel):
    symbol: str
    features: List[List[float]]


class InferRequest(BaseModel):
    symbol: str
    features: List[float]
    ts: float

    model_config = ConfigDict(populate_by_name=True)


PolicyRequest.model_rebuild()
PolicyResponse.model_rebuild()
TrainRequest.model_rebuild()
PartialFitRequest.model_rebuild()
InferRequest.model_rebuild()


class ModelArtifact:
    def __init__(self, model: Any, scaler: Any, feature_names: List[str], metadata: Dict[str, object]):
        self.model = model
        self.scaler = scaler
        self.feature_names = feature_names
        self.metadata = metadata


class CacheEntry:
    def __init__(self, mtime: float, artifact: ModelArtifact):
        self.mtime = mtime
        self.artifact = artifact


app = FastAPI(title="L2 HMM Service", version="0.2.0")

_MODEL_CACHE: Dict[str, CacheEntry] = {}


def _json_default(value: object) -> object:
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _parse_date_range(date_range: Optional[List[str]]) -> Optional[Tuple[pd.Timestamp, pd.Timestamp]]:
    if not date_range:
        return None
    if len(date_range) != 2:
        raise HTTPException(status_code=422, detail="dateRange must include [start, end]")
    start, end = (pd.to_datetime(ts, utc=True, errors="coerce") for ts in date_range)
    if start is None or pd.isna(start) or end is None or pd.isna(end):
        raise HTTPException(status_code=422, detail="dateRange entries must be parseable timestamps")
    if start > end:
        raise HTTPException(status_code=422, detail="dateRange start must be <= end")
    return start, end


def _load_historical_ticks(symbol: str, window: Optional[Tuple[pd.Timestamp, pd.Timestamp]]) -> pd.DataFrame:
    tick_dir = Path("data") / "ticks"
    frames: List[pd.DataFrame] = []
    if tick_dir.exists():
        for path in sorted(tick_dir.glob(f"{symbol}_*.csv")):
            date_token = path.stem.split("_", 1)[-1]
            try:
                file_date = pd.to_datetime(date_token, utc=True)
            except Exception:
                file_date = None
            if window and file_date is not None:
                if file_date.date() < window[0].date() or file_date.date() > window[1].date():
                    continue
            frame = pd.read_csv(path)
            frame["__source"] = path.name
            frames.append(frame)
    if not frames:
        fallback = Path("data") / f"{symbol}.csv"
        if not fallback.exists():
            raise HTTPException(status_code=404, detail=f"No historical data found for {symbol}")
        frame = pd.read_csv(fallback)
        frame["__source"] = fallback.name
        frames.append(frame)
    data = pd.concat(frames, ignore_index=True)
    if "ts" in data.columns:
        ts = pd.to_datetime(data["ts"], utc=True, errors="coerce")
    elif "datetime" in data.columns:
        ts = pd.to_datetime(data["datetime"], utc=True, errors="coerce")
    else:
        raise HTTPException(status_code=422, detail="Historical data missing timestamp column (ts or datetime)")
    data["ts"] = ts
    if window is not None:
        mask = (data["ts"] >= window[0]) & (data["ts"] <= window[1])
        data = data.loc[mask]
    data = data.sort_values("ts").reset_index(drop=True)
    if data.empty:
        raise HTTPException(status_code=404, detail="No data left after applying date filter")
    return data


def _get_numeric(df: pd.DataFrame, column: str) -> Optional[pd.Series]:
    if column not in df:
        return None
    series = pd.to_numeric(df[column], errors="coerce")
    if series.isna().all():
        return None
    return series


def _parse_feature_column(series: Optional[pd.Series]) -> pd.DataFrame:
    if series is None:
        return pd.DataFrame()
    raw = series.fillna("")
    if raw.empty:
        return pd.DataFrame(index=series.index)
    lengths = raw.apply(lambda x: len(str(x).split(";")) if str(x) else 0)
    width = int(lengths.max()) if len(lengths) else 0
    if width == 0:
        return pd.DataFrame(index=series.index)
    arr = np.full((len(series), width), np.nan, dtype=float)
    for idx, value in enumerate(raw):
        tokens = str(value).split(";") if value else []
        for j, token in enumerate(tokens):
            token = token.strip()
            if not token or token.lower() == "nan":
                continue
            try:
                arr[idx, j] = float(token)
            except ValueError:
                continue
    columns = [f"raw_feature_{i}" for i in range(width)]
    return pd.DataFrame(arr, index=series.index, columns=columns)


def _build_feature_table(raw: pd.DataFrame) -> pd.DataFrame:
    mid = _get_numeric(raw, "mid")
    if mid is None and {"bid", "ask"}.issubset(raw.columns):
        bid = _get_numeric(raw, "bid") or pd.Series(index=raw.index, data=np.nan)
        ask = _get_numeric(raw, "ask") or pd.Series(index=raw.index, data=np.nan)
        mid = (bid + ask) / 2
    if mid is None and "close" in raw.columns:
        mid = _get_numeric(raw, "close")
    if mid is None:
        raise HTTPException(status_code=422, detail="Unable to derive mid price from dataset")

    spread = _get_numeric(raw, "spreadBp")
    if spread is None and {"bid", "ask"}.issubset(raw.columns):
        bid = _get_numeric(raw, "bid")
        ask = _get_numeric(raw, "ask")
        if bid is not None and ask is not None:
            denom = (bid + ask) / 2
            spread = ((ask - bid) / denom.replace(0, np.nan)) * 10000
    if spread is None and {"high", "low"}.issubset(raw.columns):
        high = _get_numeric(raw, "high")
        low = _get_numeric(raw, "low")
        denom = ((high + low) / 2).replace(0, np.nan)
        spread = ((high - low) / denom) * 10000
    if spread is None:
        spread = pd.Series(index=raw.index, data=0.0)

    imb = _get_numeric(raw, "imb")
    if imb is None and {"bidsize", "asksize"}.issubset(raw.columns):
        bid_size = _get_numeric(raw, "bidsize")
        ask_size = _get_numeric(raw, "asksize")
        if bid_size is not None and ask_size is not None:
            denom = (bid_size + ask_size).replace(0, np.nan)
            imb = (bid_size - ask_size) / denom
    if imb is None:
        imb = pd.Series(index=raw.index, data=0.0)

    micro = None
    if {"bid", "ask", "bidsize", "asksize"}.issubset(raw.columns):
        bid = _get_numeric(raw, "bid")
        ask = _get_numeric(raw, "ask")
        bid_size = _get_numeric(raw, "bidsize")
        ask_size = _get_numeric(raw, "asksize")
        if bid is not None and ask is not None and bid_size is not None and ask_size is not None:
            denom = (bid_size + ask_size).replace(0, np.nan)
            micro = (bid * ask_size + ask * bid_size) / denom
            mid_fallback = (bid + ask) / 2
            micro = micro.fillna(mid_fallback)
    if micro is None:
        micro = mid.copy()

    volume = _get_numeric(raw, "volume")
    if volume is None:
        volume = pd.Series(index=raw.index, data=0.0)

    feature_df = pd.DataFrame(index=raw.index)
    feature_df["mid"] = mid
    feature_df["spread_bp"] = spread
    feature_df["imbalance"] = imb
    feature_df["microprice"] = micro

    mid_diff = feature_df["mid"].diff().fillna(0.0)
    feature_df["mid_velocity"] = mid_diff
    feature_df["mid_return"] = (
        feature_df["mid"].pct_change(fill_method=None).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    )
    feature_df["volatility"] = (
        feature_df["mid_return"].rolling(window=120, min_periods=25).std().bfill().fillna(0.0)
    )

    vol_roll = volume.rolling(window=120, min_periods=25)
    vol_z = (volume - vol_roll.mean()) / vol_roll.std()
    feature_df["volume_z"] = vol_z.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    parsed_features = _parse_feature_column(raw.get("features"))
    if not parsed_features.empty:
        parsed_features = parsed_features.ffill().bfill().fillna(0.0)
        for col in parsed_features.columns:
            if col in feature_df.columns:
                continue
            feature_df[col] = parsed_features[col]

    feature_df = feature_df.replace([np.inf, -np.inf], np.nan)
    feature_df = feature_df.ffill().bfill().fillna(0.0)

    mask = feature_df.notna().all(axis=1)
    feature_df = feature_df.loc[mask]
    return feature_df


def _split_dataset(features: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    values = features.to_numpy(dtype=np.float64)
    total = len(values)
    if total <= DEFAULT_N_STATES * 3:
        return values, np.empty((0, values.shape[1]))
    split_idx = int(total * (1 - HOLDOUT_FRACTION))
    split_idx = max(split_idx, DEFAULT_N_STATES * 10)
    split_idx = min(split_idx, total - DEFAULT_N_STATES)
    if split_idx <= 0 or split_idx >= total:
        return values, np.empty((0, values.shape[1]))
    return values[:split_idx], values[split_idx:]


def _save_artifact(symbol: str, artifact: ModelArtifact) -> None:
    payload = {
        "model": artifact.model,
        "scaler": artifact.scaler,
        "feature_names": artifact.feature_names,
        "metadata": artifact.metadata,
    }
    model_path = MODEL_DIR / f"{symbol}_artifact.joblib"
    joblib.dump(payload, model_path)
    metadata_path = MODEL_DIR / f"{symbol}_metadata.json"
    with metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(artifact.metadata, handle, indent=2, default=_json_default)
    mtime = model_path.stat().st_mtime
    _MODEL_CACHE[symbol] = CacheEntry(mtime=mtime, artifact=artifact)


def _load_artifact(symbol: str) -> ModelArtifact:
    model_path = MODEL_DIR / f"{symbol}_artifact.joblib"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model artifact not found for {symbol}; run /train first")
    mtime = model_path.stat().st_mtime
    cached = _MODEL_CACHE.get(symbol)
    if cached and cached.mtime == mtime:
        return cached.artifact
    data = joblib.load(model_path)
    artifact = ModelArtifact(
        model=data["model"],
        scaler=data["scaler"],
        feature_names=data["feature_names"],
        metadata=data.get("metadata", {}),
    )
    _MODEL_CACHE[symbol] = CacheEntry(mtime=mtime, artifact=artifact)
    return artifact


def _run_inference(symbol: str, features: List[float]) -> Tuple[int, List[float], float]:
    artifact = _load_artifact(symbol)
    vector = np.asarray(features, dtype=np.float64).reshape(1, -1)
    expected = len(artifact.feature_names)
    if vector.shape[1] != expected:
        raise HTTPException(
            status_code=422,
            detail=f"Feature length mismatch: expected {expected}, received {vector.shape[1]}",
        )
    transformed = artifact.scaler.transform(vector)
    state = int(artifact.model.predict(transformed)[0])
    if hasattr(artifact.model, "predict_proba"):
        probs = artifact.model.predict_proba(transformed)[0]
    else:
        log_like = artifact.model._compute_log_likelihood(transformed)[0]  # type: ignore[attr-defined]
        probs = np.exp(log_like - log_like.max())
        probs /= probs.sum()
    probs = probs.tolist()
    confidence = float(max(probs))
    return state, probs, confidence


@app.get("/health")
async def health() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/policy")
async def policy(req: PolicyRequest) -> Dict[str, object]:
    state, probs, confidence = _run_inference(req.symbol, req.features)
    artifact = _load_artifact(req.symbol)
    try:
        feature_index = artifact.feature_names.index("mid_return")
    except ValueError:
        feature_index = 0
    order = np.argsort(artifact.model.means_[:, feature_index])
    low_state = int(order[0])
    high_state = int(order[-1])
    action = "hold"
    if state == high_state:
        action = "buy"
    elif state == low_state:
        action = "sell"
    return {"state": state, "action": action, "confidence": confidence, "probs": probs}


@app.post("/train")
async def train(req: TrainRequest) -> Dict[str, object]:
    window = _parse_date_range(req.date_range)
    raw = _load_historical_ticks(req.symbol, window)
    features = _build_feature_table(raw)
    raw = raw.loc[features.index]
    required = max(DEFAULT_N_STATES * 20, MIN_TICKS_REQUIRED)
    if len(features) < required:
        raise HTTPException(status_code=422, detail=f"Not enough samples to train (have {len(features)}, need {required})")

    train_values, holdout_values = _split_dataset(features)
    scaler = StandardScaler()
    train_scaled = scaler.fit_transform(train_values)
    model = hmm.GaussianHMM(
        n_components=DEFAULT_N_STATES,
        covariance_type="diag",
        n_iter=200,
        tol=1e-3,
        min_covar=1e-4,
        random_state=42,
    )
    model.fit(train_scaled)

    train_states = model.predict(train_scaled)
    train_counts = np.bincount(train_states, minlength=DEFAULT_N_STATES)
    if np.count_nonzero(train_counts) < 2:
        raise HTTPException(status_code=422, detail="Model collapsed to a single state; adjust date range or feature set")

    holdout_counts: Optional[List[int]] = None
    holdout_entropy: Optional[float] = None
    if len(holdout_values):
        holdout_scaled = scaler.transform(holdout_values)
        holdout_states = model.predict(holdout_scaled)
        holdout_counts = np.bincount(holdout_states, minlength=DEFAULT_N_STATES).tolist()
        probs = model.predict_proba(holdout_scaled)
        entropy = -np.sum(probs * np.log(np.clip(probs, 1e-12, 1.0)), axis=1)
        holdout_entropy = float(np.mean(entropy))

    trained_at = datetime.now(timezone.utc)
    metadata: Dict[str, object] = {
        "symbol": req.symbol,
        "modelVersion": MODEL_VERSION,
        "trainedAt": trained_at.isoformat(),
        "tickCount": int(len(features)),
        "trainCount": int(len(train_values)),
        "holdoutCount": int(len(holdout_values)),
        "stateCounts": train_counts.tolist(),
        "holdoutStateCounts": holdout_counts,
        "holdoutEntropy": holdout_entropy,
        "featureSchema": features.columns.tolist(),
        "dateRange": {
            "start": raw["ts"].min().to_pydatetime().isoformat(),
            "end": raw["ts"].max().to_pydatetime().isoformat(),
        },
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "var": scaler.var_.tolist(),
        },
    }

    artifact = ModelArtifact(
        model=model,
        scaler=scaler,
        feature_names=features.columns.tolist(),
        metadata=metadata,
    )
    _save_artifact(req.symbol, artifact)

    response = metadata.copy()
    response.update({"ok": True})
    return response


@app.post("/partial_fit")
async def partial_fit(req: PartialFitRequest) -> Dict[str, object]:
    raise HTTPException(status_code=501, detail="Online partial_fit not yet implemented for HMM models")


@app.post("/infer")
async def infer(req: InferRequest) -> Dict[str, object]:
    state, probs, confidence = _run_inference(req.symbol, req.features)
    metadata = _load_artifact(req.symbol).metadata
    return {
        "state": state,
        "probs": probs,
        "action": None,
        "confidence": confidence,
        "modelVersion": metadata.get("modelVersion", MODEL_VERSION),
    }
