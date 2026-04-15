import { useState } from 'react';

interface CounterProps {
    initialCount?: number;
    label?: string;
}

export function Counter({ initialCount = 0, label = 'Count' }: CounterProps) {
    const [count, setCount] = useState(initialCount);

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-500">{label}</span>
            <div className="text-5xl font-bold text-primary-600">{count}</div>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => setCount((c) => c - 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Decrement
                </button>
                <button
                    type="button"
                    onClick={() => setCount(0)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    Reset
                </button>
                <button
                    type="button"
                    onClick={() => setCount((c) => c + 1)}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-500 transition-colors"
                >
                    Increment
                </button>
            </div>
        </div>
    );
}
