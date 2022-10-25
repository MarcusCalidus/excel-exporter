"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataExtractor = void 0;
const rxjs_1 = require("rxjs");
const ExcelJS = __importStar(require("exceljs"));
const YamlJs = __importStar(require("yamljs"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
class DataExtractor {
    getValues() {
        const settings = YamlJs.load(path_1.default.resolve(__dirname, '../config/settings.yaml'));
        return (0, rxjs_1.of)(settings.targets)
            .pipe((0, rxjs_1.mergeMap)(targets => targets), (0, rxjs_1.mergeMap)((target) => {
            const xlsxFiles = fs
                .readdirSync(target.folder)
                .filter((a) => a.match(target.filePattern));
            return (0, rxjs_1.of)(xlsxFiles)
                .pipe((0, rxjs_1.mergeMap)(files => files), (0, rxjs_1.mergeMap)(xlsxFile => {
                return new rxjs_1.Observable(this.handleXlsxFile(target, xlsxFile));
            }));
        }));
    }
    handleXlsxFile(target, xlsxFile) {
        return (subscriber) => {
            const workbook = new ExcelJS.Workbook();
            workbook.xlsx.readFile(path_1.default.resolve(target.folder, xlsxFile))
                .then(() => {
                target.metrics.forEach((metricSetting) => {
                    const worksheet = workbook.getWorksheet(metricSetting.worksheet);
                    const labels = [];
                    if (worksheet) {
                        for (const key in metricSetting.labels) {
                            if (metricSetting.labels.hasOwnProperty(key)) {
                                labels.push(key + '="' +
                                    worksheet.getCell(metricSetting.labels[key].reference).value + '"');
                            }
                        }
                        let cellValue = worksheet.getCell(metricSetting.value.reference).value;
                        if (cellValue instanceof Object) {
                            cellValue = cellValue.result;
                        }
                        if (!cellValue) {
                            cellValue = 0;
                        }
                        const metric = {
                            metric: {
                                name: metricSetting.name,
                                help: metricSetting.help,
                                metricType: metricSetting.metricType,
                            },
                            labels,
                            value: cellValue
                        };
                        subscriber.next([metric]);
                    }
                });
            })
                .then(() => subscriber.complete())
                .catch((error) => {
                console.error(error);
                subscriber.error(error);
            });
        };
    }
}
exports.DataExtractor = DataExtractor;
//# sourceMappingURL=data-exctractor.js.map