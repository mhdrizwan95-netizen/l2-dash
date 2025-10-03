import sys
sys.path.append('/Users/mrz/l2-dash/l2-dash/reference')

import datetime
import time
import os
import sys
from stat import S_IWRITE
from math import ceil
import decimal
import numpy as np
import pandas as pd
from dateutil import relativedelta
from dateutil.parser import parse as parse_date
from pytz import timezone
from ezibpy.utils import (
    createLogger, contract_expiry_from_symbol,
    order_to_dict, contract_to_dict
)

decimal.getcontext().prec = 5

# =============================================
#          Copied from qtpylib/tools.py
# =============================================

class make_object:
    """ create object from dict """
    def __init__(self, **entries):
        self.__dict__.update(entries)

def create_ib_tuple(instrument):
    """ create ib contract tuple """
    from qtpylib import futures

    if isinstance(instrument, str):
        instrument = instrument.upper()

        if "FUT." not in instrument:
            # symbol stock
            instrument = (instrument, "STK", "SMART", "USD", "", 0.0, "")

        else:
            # future contract
            try:
                symdata = instrument.split(".")

                # is this a CME future?
                if symdata[1] not in futures.futures_contracts.keys():
                    raise ValueError(
                        "Un-supported symbol. Please use full contract tuple.")

                # auto get contract details
                spec = futures.get_ib_futures(symdata[1])
                if not isinstance(spec, dict):
                    raise ValueError("Un-parsable contract tuple")

                # expiry specified?
                if len(symdata) == 3 and symdata[2] != '':
                    expiry = symdata[2]
                else:
                    # default to most active
                    expiry = futures.get_active_contract(symdata[1])

                instrument = (spec['symbol'].upper(), "FUT",
                              spec['exchange'].upper(), spec['currency'].upper(),
                              int(expiry), 0.0, "")

            except Exception as e:
                raise ValueError("Un-parsable contract tuple")

    # tuples without strike/right
    elif len(instrument) <= 7:
        instrument_list = list(instrument)
        if len(instrument_list) < 3:
            instrument_list.append("SMART")
        if len(instrument_list) < 4:
            instrument_list.append("USD")
        if len(instrument_list) < 5:
            instrument_list.append("")
        if len(instrument_list) < 6:
            instrument_list.append(0.0)
        if len(instrument_list) < 7:
            instrument_list.append("")

        try:
            instrument_list[4] = int(instrument_list[4])
        except Exception as e:
            pass

        instrument_list[5] = 0. if isinstance(instrument_list[5], str) \
            else float(instrument_list[5])

        instrument = tuple(instrument_list)

    return instrument

def gen_symbol_group(sym):
    sym = sym.strip()

    if "_FUT" in sym:
        sym = sym.split("_FUT")
        return sym[0][:-5] + "_F"

    elif "_CASH" in sym:
        return "CASH"

    if "_FOP" in sym or "_OPT" in sym:
        return sym[:-12]

    return sym

def gen_asset_class(sym):
    sym_class = str(sym).split("_")
    if len(sym_class) > 1:
        return sym_class[-1].replace("CASH", "CSH")
    return "STK"

def force_options_columns(data):
    opt_cols = ['opt_price', 'opt_underlying', 'opt_dividend', 'opt_volume',
                'opt_iv', 'opt_oi', 'opt_delta', 'opt_gamma', 'opt_vega', 'opt_theta']

    if isinstance(data, dict):
        if not set(opt_cols).issubset(data.keys()):
            data['opt_price'] = None
            data['opt_underlying'] = None
            data['opt_dividend'] = None
            data['opt_volume'] = None
            data['opt_iv'] = None
            data['opt_oi'] = None
            data['opt_delta'] = None
            data['opt_gamma'] = None
            data['opt_vega'] = None
            data['opt_theta'] = None

    elif isinstance(data, pd.DataFrame):
        if not set(opt_cols).issubset(data.columns):
            data.loc[:, 'opt_price'] = np.nan
            data.loc[:, 'opt_underlying'] = np.nan
            data.loc[:, 'opt_dividend'] = np.nan
            data.loc[:, 'opt_volume'] = np.nan
            data.loc[:, 'opt_iv'] = np.nan
            data.loc[:, 'opt_oi'] = np.nan
            data.loc[:, 'opt_delta'] = np.nan
            data.loc[:, 'opt_gamma'] = np.nan
            data.loc[:, 'opt_vega'] = np.nan
            data.loc[:, 'opt_theta'] = np.nan

    return data

def get_timezone(as_timedelta=False):
    """ utility to get the machine's timezone """
    try:
        offset_hour = -(time.altzone if time.daylight else time.timezone)
    except Exception as e:
        offset_hour = -(datetime.datetime.now() -
                        datetime.datetime.utcnow()).seconds

    offset_hour = offset_hour // 3600
    offset_hour = offset_hour if offset_hour < 10 else offset_hour // 10

    if as_timedelta:
        return datetime.timedelta(hours=offset_hour)

    return 'Etc/GMT%+d' % offset_hour

def set_timezone(data, tz=None, from_local=False):
    """ change the timeozone to specified one without converting """
    # pandas object?
    if isinstance(data, pd.DataFrame) | isinstance(data, pd.Series):
        try:
            try:
                data.index = data.index.tz_convert(tz)
            except Exception as e:
                if from_local:
                    data.index = data.index.tz_localize(
                        get_timezone()).tz_convert(tz)
                else:
                    data.index = data.index.tz_localize('UTC').tz_convert(tz)
        except Exception as e:
            pass

    # not pandas...
    else:
        if isinstance(data, str):
            data = parse_date(data)
        try:
            try:
                data = data.astimezone(tz)
            except Exception as e:
                data = timezone('UTC').localize(data).astimezone(timezone(tz))
        except Exception as e:
            pass

    return data

def resample(data, resolution="1T", tz=None, ffill=True, dropna=False,
             sync_last_timestamp=True):

    def __finalize(data, tz=None):
        # figure out timezone
        try:
            tz = data.index.tz if tz is None else tz
        except Exception as e:
            pass

        if str(tz) != 'None':
            try:
                data.index = data.index.tz_convert(tz)
            except Exception as e:
                data.index = data.index.tz_localize('UTC').tz_convert(tz)

        # sort by index (datetime)
        data.sort_index(inplace=True)

        # drop duplicate rows per instrument
        data.loc[:, '_idx_'] = data.index
        data.drop_duplicates(
            subset=['_idx_', 'symbol', 'symbol_group', 'asset_class'],
            keep='last', inplace=True)
        data.drop('_idx_', axis=1, inplace=True)

        return data

    if data.empty:
        return __finalize(data, tz)
    
    periods = int("".join([s for s in resolution if s.isdigit()]))
    meta_data = data.groupby(["symbol"])[['symbol', 'symbol_group', 'asset_class']].last()
    combined = []
    
    bars_ohlc_dict = {
            'open':           'first',
            'high':           'max',
            'low':            'min',
            'close':          'last',
            'volume':         'sum',
    }
    
    for sym in meta_data.index.values:
        bar_dict = {}
        for col in data[data['symbol'] == sym].columns:
            if col in bars_ohlc_dict.keys():
                bar_dict[col] = bars_ohlc_dict[col]

        original_length = len(data[data['symbol'] == sym])
        symdata = data[data['symbol'] == sym].resample(
            resolution).apply(bar_dict).fillna(value=np.nan)

        # deal with new rows caused by resample
        if len(symdata) > original_length:
            # volume is 0 on rows created using resample
            symdata['volume'].fillna(0, inplace=True)
            symdata.ffill(inplace=True)

            # no fill / return original index
            if ffill:
                symdata['open'] = np.where(symdata['volume'] <= 0,
                                            symdata['close'], symdata['open'])
                symdata['high'] = np.where(symdata['volume'] <= 0,
                                            symdata['close'], symdata['high'])
                symdata['low'] = np.where(symdata['volume'] <= 0,
                                            symdata['close'], symdata['low'])
            else:
                symdata['open'] = np.where(symdata['volume'] <= 0,
                                            np.nan, symdata['open'])
                symdata['high'] = np.where(symdata['volume'] <= 0,
                                            np.nan, symdata['high'])
                symdata['low'] = np.where(symdata['volume'] <= 0,
                                            np.nan, symdata['low'])
                symdata['close'] = np.where(symdata['volume'] <= 0,
                                            np.nan, symdata['close'])

        # drop NANs
        if dropna:
            symdata.dropna(inplace=True)

        symdata['symbol'] = sym
        symdata['symbol_group'] = meta_data[meta_data.index ==
                                            sym]['symbol_group'].values[0]
        symdata['asset_class'] = meta_data[meta_data.index ==
                                            sym]['asset_class'].values[0]

        # cleanup
        symdata.dropna(inplace=True, subset=[
                        'open', 'high', 'low', 'close', 'volume'])
        if sym[-3:] in ("OPT", "FOP"):
            symdata.dropna(inplace=True)

        combined.append(symdata)

    data = pd.concat(combined, sort=True)
    data['volume'] = data['volume'].astype(int)

    return __finalize(data, tz)


# =============================================
# Copied from qtpylib/workflow.py
# =============================================

_BARS_COLSMAP = {
    'open': 'open',
    'high': 'high',
    'low': 'low',
    'close': 'close',
    'volume': 'volume',
    'opt_price': 'opt_price',
    'opt_underlying': 'opt_underlying',
    'opt_dividend': 'opt_dividend',
    'opt_volume': 'opt_volume',
    'opt_iv': 'opt_iv',
    'opt_oi': 'opt_oi',
    'opt_delta': 'opt_delta',
    'opt_gamma': 'opt_gamma',
    'opt_vega': 'opt_vega',
    'opt_theta': 'opt_theta'
}
_TICKS_COLSMAP = {
    'bid': 'bid',
    'bidsize': 'bidsize',
    'ask': 'ask',
    'asksize': 'asksize',
    'last': 'last',
    'lastsize': 'lastsize',
    'opt_price': 'opt_price',
    'opt_underlying': 'opt_underlying',
    'opt_dividend': 'opt_dividend',
    'opt_volume': 'opt_volume',
    'opt_iv': 'opt_iv',
    'opt_oi': 'opt_oi',
    'opt_delta': 'opt_delta',
    'opt_gamma': 'opt_gamma',
    'opt_vega': 'opt_vega',
    'opt_theta': 'opt_theta'
}

def validate_columns(df, kind="BAR", raise_errors=True):
    global _TICKS_COLSMAP, _BARS_COLSMAP
    # validate columns
    if "asset_class" not in df.columns:
        if raise_errors:
            raise ValueError('Column asset_class not found')
        return False

    is_option = "OPT" in list(df['asset_class'].unique())

    colsmap = _TICKS_COLSMAP if kind == "TICK" else _BARS_COLSMAP

    for el in colsmap:
        col = colsmap[el]
        if col not in df.columns:
            if "opt_" in col and is_option:
                if raise_errors:
                    raise ValueError('Column %s not found' % el)
                return False
            elif "opt_" not in col and not is_option:
                if raise_errors:
                    raise ValueError('Column %s not found' % el)
                return False
    return True

def prepare_data(instrument, data, output_path=None,
                 index=None, colsmap=None, kind="BAR", resample_freq="1T"):
    """
    Converts given DataFrame to a QTPyLib-compatible format and timezone
    """

    global _TICKS_COLSMAP, _BARS_COLSMAP

    # work on copy
    df = data.copy()

    # lower case columns
    df.columns = map(str.lower, df.columns)

    # set index
    if index is None:
        index = df.index

    # set defaults columns
    if not isinstance(colsmap, dict):
        colsmap = {}

    _colsmap = _TICKS_COLSMAP if kind == "TICK" else _BARS_COLSMAP
    for el in _colsmap:
        if el not in colsmap:
            colsmap[el] = _colsmap[el]

    # generate a valid ib tuple
    instrument = create_ib_tuple(instrument)

    # create contract string (no need for connection)
    # contract_string = ibConn.contractString(instrument)
    # asset_class = gen_asset_class(contract_string)
    # symbol_group = gen_symbol_group(contract_string)
    
    # Simplified for offline use
    contract_string = f'{instrument[0]}_{instrument[1]}'
    asset_class = instrument[1]
    symbol_group = instrument[0]


    # add symbol data
    df.loc[:, 'symbol'] = contract_string
    df.loc[:, 'symbol_group'] = symbol_group
    df.loc[:, 'asset_class'] = asset_class

    # validate columns
    valid_cols = validate_columns(df, kind)
    if not valid_cols:
        raise ValueError('Invalid Column list')

    # rename columns to map
    df.rename(columns=colsmap, inplace=True)

    # force option columns on options
    if asset_class == "OPT":
        df = force_options_columns(df)

    # remove all other columns
    known_cols = list(colsmap.values()) + \
        ['symbol', 'symbol_group', 'asset_class', 'expiry']
    for col in df.columns:
        if col not in known_cols:
            df.drop(col, axis=1, inplace=True)

    # set UTC index
    df.index = pd.to_datetime(index)
    df = set_timezone(df, "UTC")
    df.index.rename("datetime", inplace=True)

    # resample
    if resample_freq and kind == "BAR":
        df = resample(df, resolution=resample_freq, tz="UTC")

    # add expiry
    df.loc[:, 'expiry'] = np.nan
    if asset_class in ("FUT", "OPT", "FOP"):
        df.loc[:, 'expiry'] = contract_expiry_from_symbol(contract_string)

    # save csv
    if output_path is not None:
        output_path = output_path[:-1] if output_path.endswith('/') else output_path
        # file_name = f'{output_path}/{contract_string}.{kind}.csv'
        file_name = f'{output_path}/{contract_string}.csv'
        df.to_csv(file_name)
        print(f'Saved data to {file_name}')

    # return df
    return df

# =============================================
#           New Functions
# =============================================

def generate_sample_data(days=5, freq='1min'):
    """
    Generates a pandas DataFrame with sample OHLCV data.
    """
    start_date = datetime.datetime.now() - datetime.timedelta(days=days)
    end_date = datetime.datetime.now()
    index = pd.date_range(start=start_date, end=end_date, freq=freq)
    
    data = {
        'open': np.random.uniform(100, 200, size=len(index)),
        'high': np.random.uniform(100, 200, size=len(index)),
        'low': np.random.uniform(100, 200, size=len(index)),
        'close': np.random.uniform(100, 200, size=len(index)),
        'volume': np.random.randint(1000, 10000, size=len(index))
    }
    
    df = pd.DataFrame(data, index=index)
    df['high'] = df[['open', 'high', 'low', 'close']].max(axis=1)
    df['low'] = df[['open', 'high', 'low', 'close']].min(axis=1)
    
    return df

def fetch_and_save_historical_data(instrument, days=5, freq='1min', output_path='data'):
    """
    Generates sample historical data and saves it to a CSV file.
    """
    print(f"Generating sample data for {instrument}...")
    df = generate_sample_data(days=days, freq=freq)
    
    print("Preparing data...")
    prepared_df = prepare_data(instrument, df, output_path=output_path, resample_freq=freq)
    
    return prepared_df

if __name__ == '__main__':
    # Example usage
    fetch_and_save_historical_data(("SPY", "STK", "SMART", "USD"))