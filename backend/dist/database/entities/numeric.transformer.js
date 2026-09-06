"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integerMoneyTransformer = void 0;
exports.integerMoneyTransformer = {
    to: (value) => value,
    from: (value) => (value == null ? 0 : Number(value)),
};
//# sourceMappingURL=numeric.transformer.js.map