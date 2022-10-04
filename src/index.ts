import express from 'express';
import {DataExtractor} from './data-exctractor';
import {catchError, EMPTY, toArray} from 'rxjs';

const serverPort = 9973;
const app = express();
const dataExtractor = new DataExtractor();

app.get('/valuesJson', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    dataExtractor.getValues().pipe(
            toArray(),
            catchError(error => {
                res.statusCode = 500;
                res.end(JSON.stringify({success: false, error}));
                return EMPTY;
            })
        )
        .subscribe(
            data => {
                res.end(JSON.stringify({success: true, data}));
            }
        );
});

app.get('/values', (req, res) => {
    res.setHeader('Content-Type', 'text/plain;charset=utf-8');

    dataExtractor.getValues().pipe(
            toArray(),
            catchError(error => {
                res.statusCode = 500;
                res.end(JSON.stringify({success: false, error}));
                return EMPTY;
            })
        )
        .subscribe(
            (data: any[]) => {
                const result: string[] = [];
                data.forEach(
                    (metric: any) => {
                        result.push(`# HELP ${metric[0].metric.name} ${metric[0].metric.help}`);
                        result.push(`# TYPE ${metric[0].metric.name} ${metric[0].metric.metricType}`);
                        metric.forEach(
                            (line: any) => result.push(`${line.metric.name}${(line.labels || []).length > 0 ? '{' + line.labels.join(',') + '}' : ''} ${line.value}`)
                        );
                    }
                );
                res.end(result.join('\n') + '\n');
            },
            error => {
                res.statusCode = 500;
                res.end(error.toString())
            }
        );
});

// start the Express server
app.listen(serverPort, () => {
    console.log(`server started at http://localhost:${serverPort}`);
});
