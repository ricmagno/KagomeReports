/**
 * Common color palette for charts to ensure consistency 
 * between multi-trend and individual trend views.
 */

export const CHART_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald (green)
    '#f59e0b', // amber (orange)
    '#f43f5e', // rose
    '#6366f1', // indigo
    '#f97316', // orange-dark
    '#06b6d4', // cyan
    '#8b5cf6', // violet
];

/**
 * Assigns a stable color to a tag based on its index in a list.
 */
export const getTagColor = (index: number): string | undefined => {
    if (index < 0) return undefined;
    return CHART_COLORS[index % CHART_COLORS.length];
};

/**
 * Finds the index of a tag in a list, case-insensitively.
 */
export const getTagIndex = (tagName: string, tags: string[]): number => {
    if (!tagName || !tags) return -1;
    const lowerTag = tagName.toLowerCase().trim();
    return tags.findIndex(t => t && t.toLowerCase().trim() === lowerTag);
};
