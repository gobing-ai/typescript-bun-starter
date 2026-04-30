// Re-export from canonical location for backward compatibility.
// New code should import from './schema/common' directly.
export {
    buildStandardColumns,
    buildStandardColumnsWithSoftDelete,
    nowTimestamp,
    type StandardColumns,
    type StandardColumnsWithSoftDelete,
    standardColumns,
    standardColumnsWithSoftDelete,
} from './schema/common';
