import {mergeMap, Observable, of, Subscriber} from 'rxjs';
import * as ExcelJS from 'exceljs'
import * as YamlJs from 'yamljs';
import path from 'path';
import * as fs from 'fs';

export class DataExtractor {
    getValues(): Observable<any> {
        const settings = YamlJs.load(path.resolve(__dirname, '../config/settings.yaml'));

        return of(settings.targets)
            .pipe(
                mergeMap(targets => targets),
                mergeMap( (target: any) => {
                    const xlsxFiles: string[] = fs
                        .readdirSync(target.folder)
                        .filter((a: string) => a.match(target.filePattern));

                    return of(xlsxFiles)
                        .pipe(
                            mergeMap(files => files),
                            mergeMap(
                                xlsxFile => {
                                    return new Observable<any[]>(this.handleXlsxFile(target, xlsxFile))
                                }
                            )
                        )
                })
            )
    }

    private handleXlsxFile<A>(target: any, xlsxFile: string) {
        return (subscriber: Subscriber<any>) => {
            const workbook = new ExcelJS.Workbook();

            workbook.xlsx.readFile(path.resolve(target.folder, xlsxFile))
                .then(
                    () => {
                        target.metrics.forEach(
                            (metricSetting: any) => {
                                const worksheet = workbook.getWorksheet(metricSetting.worksheet);

                                const labels = [];
                                if (worksheet) {
                                    for (const key in metricSetting.labels) {
                                        if (metricSetting.labels.hasOwnProperty(key)) {
                                            labels.push(
                                                key + '="' +
                                                worksheet.getCell(
                                                    metricSetting.labels[key].reference
                                                ).value + '"'
                                            );
                                        }
                                    }

                                    let cellValue = worksheet.getCell(
                                        metricSetting.value.reference
                                    ).value;

                                    if (cellValue instanceof Object) {
                                        cellValue = (cellValue as any).result;
                                    }

                                    if (!cellValue) {
                                        cellValue = 0
                                    }

                                    const metric = {
                                        metric: {
                                            name: metricSetting.name,
                                            help: metricSetting.help,
                                            metricType: metricSetting.metricType,
                                        },
                                        labels,
                                        value: cellValue
                                    }

                                    subscriber.next([metric]);
                                }
                            }
                        )
                    }
                )
                .then(
                    () => subscriber.complete()
                )
                .catch(
                    (error) => {
                        console.error(error);
                        subscriber.error(error);
                    }
                )
        };
    }
}
