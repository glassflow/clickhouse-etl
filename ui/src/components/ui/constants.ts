/**
 * Shared UI constants for components
 */

/**
 * Collision padding for dropdown positioning.
 * Prevents dropdowns from opening underneath the fixed header (top: 72px).
 * Used by Select, Popover, and Combobox components.
 */
export const DROPDOWN_COLLISION_PADDING = { top: 72, bottom: 16, left: 16, right: 16 } as const

export type DropdownCollisionPadding = typeof DROPDOWN_COLLISION_PADDING
