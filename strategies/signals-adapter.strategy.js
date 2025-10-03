"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Adapter: exposes all *.signals.json as test strategies
function loadSignalJsonFiles(dir = path_1.default.resolve("strategies")) {
    if (!fs_1.default.existsSync(dir))
        return [];
    return fs_1.default.readdirSync(dir)
        .filter(f => f.endsWith(".signals.json"))
        .map(f => path_1.default.join(dir, f));
}
const adapters = loadSignalJsonFiles().map((file) => {
    const raw = JSON.parse(fs_1.default.readFileSync(file, "utf8"));
    const id = raw.id || path_1.default.basename(file, ".signals.json");
    const name = raw.description || id;
    const signals = (raw.signals || []).map((s) => {
        var _a, _b, _c, _d, _e;
        return ({
            time: (_a = s.time) !== null && _a !== void 0 ? _a : new Date().toISOString(),
            symbol: (_b = s.symbol) !== null && _b !== void 0 ? _b : "DEMO",
            price: Number((_c = s.price) !== null && _c !== void 0 ? _c : 100),
            qty: Number((_d = s.qty) !== null && _d !== void 0 ? _d : 1),
            side: ((_e = s.side) !== null && _e !== void 0 ? _e : "BUY"),
        });
    });
    return {
        id,
        name: `[signals] ${name}`,
        ui: {
            schema: {},
            defaults: {},
        },
        async generateSignals(_params, isoDate) {
            const d = isoDate.slice(0, 10);
            return signals.filter(s => !s.time || s.time.startsWith(d));
        },
        describe: () => `Adapter for ${file}`,
    };
});
exports.default = adapters;
