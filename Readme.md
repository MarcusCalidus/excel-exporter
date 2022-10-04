# excel-exporter - a Prometheus exporter for Excel files

Excel-exporter is a generic Prometheus exporter for 
 Excel files. It will iterate all files in one folder finding values and labels on a spreadsheet.

## Prerequisites
In order to run excel-exporter you need Node.js installed on your system.

## Installation
The Installation is simple as can be. 
```
npm i
```

## Configuration

The exporter is configured via the `settings.yaml` file located in the `config` folder. At the moment you can only access one folder containing excel files.

You will have to create a `settings.yaml` before you can start the server!

```
targets:
  - folder: /Users/marcowarm/Downloads/teams
    metrics:
      - name: team_output_target_quantity
        metricType: gauge
        help: output quantity expected by the team
        worksheet: Tägliche Meldung
        labels:
          team:
            reference: W2
          schicht:
            reference: N2
        value:
          reference: K30
      - name: team_output_actual_quantity
        metricType: gauge
        help: output quantity expected by the team
        worksheet: Tägliche Meldung
        labels:
          team:
            reference: W2
          schicht:
            reference: N2
        value:
          reference: M30
```

## Running
To start the server run. 

```
node path/to/excel-exporter
```

or

```
npx path/to/excel-exporter
```

(You might want to run this as a service)

## Getting the values
The exporter provides the values as follows

```
http://{YourExporterServer}:9973/values

e.g. http://localhost:9973/values

Raw JSON Data like so: http://{YourExporterServer}:9973/valuesJson
```
