import React, { ReactNode } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface Column<T> {
    key: keyof T | string;
    label: string;
    render?: (item: T) => ReactNode;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
    maxHeight?: string;
}

export default function DataTable<T extends { id: number | string }>({
    data,
    columns,
    onRowClick,
    emptyMessage = 'No data available',
    maxHeight,
}: DataTableProps<T>) {
    if (data.length === 0) {
        return (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm text-center py-12">
                <p className="text-slate-500 font-mono">{emptyMessage}</p>
            </div>
        );
    }

    const alignClass = (align?: string) => {
        switch (align) {
            case 'center': return 'text-center';
            case 'right': return 'text-right';
            default: return 'text-left';
        }
    };

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm overflow-hidden">
            <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
                <table className="w-full">
                    <thead className="bg-slate-900/50 sticky top-0 z-10">
                        <tr>
                            {columns.map((column, index) => (
                                <th
                                    key={index}
                                    className={`px-6 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider ${alignClass(column.align)}`}
                                >
                                    <div className={`flex items-center gap-2 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                                        {column.label}
                                        {column.sortable && (
                                            <ArrowUpDown className="w-3 h-3 text-slate-600" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {data.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => onRowClick?.(item)}
                                className={`hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                            >
                                {columns.map((column, colIndex) => (
                                    <td key={colIndex} className={`px-6 py-4 whitespace-nowrap text-sm ${alignClass(column.align)}`}>
                                        {column.render
                                            ? column.render(item)
                                            : String((item as Record<string, unknown>)[column.key as string] || '-')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
