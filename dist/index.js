"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const data_exctractor_1 = require("./data-exctractor");
const rxjs_1 = require("rxjs");
const serverPort = 9973;
const app = (0, express_1.default)();
const dataExtractor = new data_exctractor_1.DataExtractor();
app.get('/valuesJson', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    dataExtractor.getValues().pipe((0, rxjs_1.toArray)(), (0, rxjs_1.catchError)(error => {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error }));
        return rxjs_1.EMPTY;
    }))
        .subscribe(data => {
        res.end(JSON.stringify({ success: true, data }));
    });
});
app.get('/values', (req, res) => {
    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    dataExtractor.getValues().pipe((0, rxjs_1.toArray)(), (0, rxjs_1.catchError)(error => {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error }));
        return rxjs_1.EMPTY;
    }))
        .subscribe((data) => {
        const result = [];
        data.forEach((metric) => {
            result.push(`# HELP ${metric[0].metric.name} ${metric[0].metric.help}`);
            result.push(`# TYPE ${metric[0].metric.name} ${metric[0].metric.metricType}`);
            metric.forEach((line) => result.push(`${line.metric.name}${(line.labels || []).length > 0 ? '{' + line.labels.join(',') + '}' : ''} ${line.value}`));
        });
        res.end(result.join('\n') + '\n');
    }, error => {
        res.statusCode = 500;
        res.end(error.toString());
    });
});
// start the Express server
app.listen(serverPort, () => {
    console.log(`server started at http://localhost:${serverPort}`);
});
//# sourceMappingURL=index.js.map