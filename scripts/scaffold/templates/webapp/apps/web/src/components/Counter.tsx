import { useState } from 'react';

interface CounterProps {
    initialCount?: number;
    label?: string;
}

export function Counter({ initialCount = 0, label = 'Count' }: CounterProps) {
    const [count, setCount] = useState(initialCount);

    return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <span className="text-sm font-medium text-gray-500">{label}</span>
            <div className="text-5xl font-bold text-primary-600">{count}</div>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => setCount((current) => current - 1)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                    Decrement
                </button>
                <button
                    type="button"
                    onClick={() => setCount(0)}
                    className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
                >
                    Reset
                </button>
                <button
                    type="button"
                    onClick={() => setCount((current) => current + 1)}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
                >
                    Increment
                </button>
            </div>
        </div>
    );
}
