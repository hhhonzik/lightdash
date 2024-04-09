import {
    CreateStarrocksCredentials,
    DimensionType,
    Metric,
    MetricType,
    SupportedDbtAdapter,
    WarehouseConnectionError,
    WarehouseQueryError,
} from '@lightdash/common';
import {
    Connection,
    ConnectionOptions,
    FieldPacket,
    RowDataPacket,
    Types,
    createConnection
} from 'mysql2/promise';
import { WarehouseCatalog } from '../types';
import WarehouseBaseClient from './WarehouseBaseClient';


interface TableInfo {
    database: string;
    schema: string;
    table: string;
}

export enum StarrocksTypes {
    BOOLEAN = 'boolean',
    TINYINT = 'tinyint',
    SMALLINT = 'smallint',
    INTEGER = 'integer',
    BIGINT = 'bigint',
    REAL = 'real',
    DOUBLE = 'double',
    DECIMAL = 'decimal',
    VARCHAR = 'varchar',
    CHAR = 'char',
    VARBINARY = 'varbinary',
    JSON = 'json',
    DATE = 'date',
    TIME = 'time',
    TIME_TZ = 'time with time zone',
    TIMESTAMP = 'timestamp',
    TIMESTAMP_TZ = 'timestamp with time zone',
    INTERVAL_YEAR_MONTH = 'interval year to month',
    INTERVAL_DAY_TIME = 'interval day to second',
    ARRAY = 'array',
    MAP = 'map',
    ROW = 'row',
    UUID = 'uuid',
}

const queryTableSchema = ({
    database,
    schema,
    table,
}: TableInfo) => `SELECT table_catalog
            , table_schema
            , table_name
            , column_name
            , data_type
    FROM default_catalog.information_schema.columns
    WHERE
        table_schema = '${schema}'
        AND table_name = '${table}'
    ORDER BY 1, 2, 3, ordinal_position`;



const convertStarrocksDataTypeToDimensionType = (
    type: StarrocksTypes | string,
): DimensionType => {
    const typeWithoutTimePrecision = type.replace(/\(\d\)/, '');
    switch (typeWithoutTimePrecision) {
        case StarrocksTypes.BOOLEAN:
            return DimensionType.BOOLEAN;
        case StarrocksTypes.TINYINT:
            return DimensionType.NUMBER;
        case StarrocksTypes.SMALLINT:
            return DimensionType.NUMBER;
        case StarrocksTypes.INTEGER:
            return DimensionType.NUMBER;
        case StarrocksTypes.BIGINT:
            return DimensionType.NUMBER;
        case StarrocksTypes.REAL:
            return DimensionType.NUMBER;
        case StarrocksTypes.DOUBLE:
            return DimensionType.NUMBER;
        case StarrocksTypes.DECIMAL:
            return DimensionType.NUMBER;
        case StarrocksTypes.DATE:
            return DimensionType.DATE;
        case StarrocksTypes.TIMESTAMP:
            return DimensionType.TIMESTAMP;
        case StarrocksTypes.TIMESTAMP_TZ:
            return DimensionType.TIMESTAMP;
        default:
            return DimensionType.STRING;
    }
};
const convertDataTypeToDimensionType = (
    type: number | undefined,
): DimensionType => {
    switch (type) {
        case Types.BIT:
            return DimensionType.BOOLEAN;
        case Types.TINY:
        case Types.SHORT:
        case Types.FLOAT:
        case Types.NEWDECIMAL:
        case Types.DECIMAL:
        case Types.INT24:
        case Types.LONG:
        case Types.LONGLONG:
        case Types.DOUBLE:
            return DimensionType.NUMBER;
        case Types.DATE:
            return DimensionType.DATE;
        case Types.TIMESTAMP:
            return DimensionType.TIMESTAMP;
        case Types.TIME:
            return DimensionType.TIMESTAMP;
        default:
            return DimensionType.STRING;
    }
};

export class StarrocksWarehouseClient extends WarehouseBaseClient<CreateStarrocksCredentials> {
    connectionOptions: ConnectionOptions;

    constructor(credentials: CreateStarrocksCredentials) {
        super(credentials);
        this.connectionOptions = {
            user: credentials.user,
            password: credentials.password,
            // database: credentials.catalog ? `${credentials.catalog}.${credentials.schema}` : credentials.schema,
            // database: credentials.catalog,
            host: credentials.host,
            port: credentials.port,
        };
    }

    private async getSession() {
        let session: Connection;
        try {
            session = await createConnection(this.connectionOptions);
        } catch (e: any) {
            throw new WarehouseConnectionError(e.message);
        }

        return {
            session,
            close: async () => {
                console.info('Close starrocks connection');
            },
        };
    }

    private convertQueryResultFields(
        fields: FieldPacket[],
    ): Record<string, { type: DimensionType }> {
        return fields.reduce((agg, field) => ({
            ...agg,
            [field.name]: {
                type: convertDataTypeToDimensionType(field.columnType)
            }
        }), {});
    }


    async runQuery(sql: string, tags?: Record<string, string>) {
        const { session, close } = await this.getSession();
        let rows: RowDataPacket[]
        let fields: FieldPacket[];
        try {
            let alteredQuery = sql;
            if (tags) {
                alteredQuery = `${alteredQuery}\n-- ${JSON.stringify(tags)}`;
            }
            [rows, fields] = await session.query<RowDataPacket[]>(sql);

            return {
                fields: this.convertQueryResultFields(fields),
                rows
            };
        } catch (e: any) {
            throw new WarehouseQueryError(e.message);
        } finally {
            await close();
        }
    }

    // TODO: Implement
    async getCatalog(requests: TableInfo[]): Promise<WarehouseCatalog> {
        const warehouseCatalog: WarehouseCatalog = {};
    
        await Promise.all(requests.map(async (request) => {
            try {
                const { rows } = await this.runQuery(queryTableSchema(request));
                rows.forEach((row) => {
                    row.table_catalog = row.table_catalog ?? request.database;

                    if (!warehouseCatalog[row.table_catalog]) {
                        warehouseCatalog[row.table_catalog] = {}
                    }
                    if (!warehouseCatalog[row.table_catalog][row.table_schema]) {
                        warehouseCatalog[row.table_catalog][row.table_schema] = {}
                    }

                    if (!warehouseCatalog[row.table_catalog][row.table_schema][row.table_name]) {
                        warehouseCatalog[row.table_catalog][row.table_schema][row.table_name] = {}
                    }

                    warehouseCatalog[row.table_catalog][row.table_schema][row.table_name][row.column_name] = convertStarrocksDataTypeToDimensionType(row.data_type);   
                })
                // const result = (await query.next()).value.data ?? [];
                // return result;
            } catch (e: any) {
                throw new WarehouseQueryError(e.message);
            }
        }));
        
        return warehouseCatalog
    }

    getFieldQuoteChar() {
        return '';
    }

    getStringQuoteChar() {
        return "'";
    }

    getEscapeStringQuoteChar() {
        return "'";
    }

    getAdapterType(): SupportedDbtAdapter {
        return SupportedDbtAdapter.STARROCKS;
    }

    getMetricSql(sql: string, metric: Metric) {
        switch (metric.type) {
            case MetricType.PERCENTILE:
                return `APPROX_PERCENTILE(${sql}, ${(metric.percentile ?? 50) / 100
                    })`;
            case MetricType.MEDIAN:
                return `APPROX_PERCENTILE(${sql},0.5)`;
            default:
                return super.getMetricSql(sql, metric);
        }
    }
}
