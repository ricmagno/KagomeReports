---
inclusion: always
---

# Design System Rules for Kagome Reports Application

## Project Overview
This is a React.js + Node.js application for generating reports from AVEVA Historian database. The system follows modern web development practices with a focus on professional, data-driven interfaces.

## Technology Stack

### Frontend Framework
- **React.js** with TypeScript for type safety
- **Component-based architecture** for modular UI development
- **Responsive design** capabilities for various screen sizes

### Styling Approach
- **CSS Modules** or **Styled Components** for component-scoped styling
- **Tailwind CSS** for utility-first styling and rapid development
- **CSS Custom Properties** for design tokens and theming

### Build System
- **Vite** or **Create React App** for development and build tooling
- **Docker** multi-stage builds for production deployment
- **Multi-architecture support** (ARM64/AMD64)

## Design System Structure

### 1. Token Definitions

**Location**: `src/design-tokens/` or `src/styles/tokens/`

**Color Palette**:
```typescript
// colors.ts
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    500: '#0ea5e9',
    600: '#0284c7',
    900: '#0c4a6e'
  },
  
  // Semantic colors for data visualization
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Neutral grays for UI elements
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    500: '#6b7280',
    700: '#374151',
    900: '#111827'
  },
  
  // Data visualization colors
  chart: {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    orange: '#f97316'
  }
}
```

**Typography Scale**:
```typescript
// typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace']
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem' // 30px
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
}
```

**Spacing System**:
```typescript
// spacing.ts
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem'     // 80px
}
```

### 2. Component Library

**Location**: `src/components/`

**Component Architecture**:
```
src/components/
├── ui/                 # Basic UI components
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Modal/
│   └── Table/
├── charts/            # Data visualization components
│   ├── LineChart/
│   ├── BarChart/
│   ├── TrendChart/
│   └── StatisticsCard/
├── forms/             # Form-specific components
│   ├── TimeRangePicker/
│   ├── TagSelector/
│   └── ReportConfigForm/
└── layout/            # Layout components
    ├── Header/
    ├── Sidebar/
    ├── Dashboard/
    └── ReportPreview/
```

**Component Patterns**:
```typescript
// Example Button component structure
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick
}) => {
  // Component implementation
}
```

### 3. Asset Management

**Location**: `public/assets/` and `src/assets/`

**Structure**:
```
public/assets/
├── images/
│   ├── logos/
│   ├── icons/
│   └── charts/
└── fonts/

src/assets/
├── icons/             # SVG icons as React components
└── images/            # Imported images
```

**Icon System**:
- **Lucide React** or **Heroicons** for consistent icon library
- Custom SVG icons stored as React components
- Icon naming convention: `IconName` (PascalCase)

```typescript
// Icon usage pattern
import { BarChart3, Download, Settings } from 'lucide-react'

// Custom icon component
export const ChartIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* SVG content */}
  </svg>
)
```

### 4. Styling Guidelines

**CSS Methodology**: Utility-first with Tailwind CSS + component-scoped styles

**Global Styles**: `src/styles/globals.css`
```css
/* Design tokens as CSS custom properties */
:root {
  --color-primary-500: #0ea5e9;
  --color-gray-50: #f9fafb;
  --font-family-sans: 'Inter', system-ui, sans-serif;
  --spacing-4: 1rem;
}

/* Base styles */
body {
  font-family: var(--font-family-sans);
  color: var(--color-gray-900);
  background-color: var(--color-gray-50);
}
```

**Component Styling Pattern**:
```typescript
// Using Tailwind classes with conditional styling
const buttonClasses = cn(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  {
    'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
    'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
    'px-3 py-2 text-sm': size === 'sm',
    'px-4 py-2 text-base': size === 'md',
    'px-6 py-3 text-lg': size === 'lg',
    'opacity-50 cursor-not-allowed': disabled
  }
)
```

### 5. Data Visualization Standards

**Chart Library**: Chart.js or Recharts for React integration

**Chart Color Palette**:
- Use semantic colors for different data types
- Maintain accessibility with sufficient color contrast
- Provide alternative visual indicators (patterns, shapes) for colorblind users

**Chart Components**:
```typescript
interface ChartProps {
  data: TimeSeriesData[]
  title?: string
  showLegend?: boolean
  height?: number
  theme?: 'light' | 'dark'
}

// Consistent chart styling
const chartTheme = {
  colors: [
    colors.chart.blue,
    colors.chart.green,
    colors.chart.yellow,
    colors.chart.red,
    colors.chart.purple,
    colors.chart.orange
  ],
  grid: {
    color: colors.gray[200]
  },
  text: {
    color: colors.gray[700],
    fontFamily: typography.fontFamily.sans
  }
}
```

### 6. Responsive Design

**Breakpoints**:
```typescript
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
}
```

**Layout Patterns**:
- Mobile-first responsive design
- Flexible grid systems using CSS Grid and Flexbox
- Responsive typography and spacing scales
- Touch-friendly interface elements (minimum 44px touch targets)

### 7. Accessibility Standards

**Requirements**:
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios of 4.5:1 for normal text, 3:1 for large text

**Implementation**:
```typescript
// Accessible button example
<button
  type="button"
  aria-label="Generate report"
  aria-describedby="report-help-text"
  disabled={isLoading}
  className={buttonClasses}
>
  {isLoading ? <Spinner aria-hidden="true" /> : <Download />}
  Generate Report
</button>
```

### 8. Form Design Patterns

**Form Components**:
- Consistent input styling with focus states
- Clear validation messages
- Loading states for async operations
- Progressive disclosure for complex forms

```typescript
interface InputProps {
  label: string
  error?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

// Form validation patterns
const reportConfigSchema = z.object({
  name: z.string().min(1, 'Report name is required'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  timeRange: z.object({
    startTime: z.date(),
    endTime: z.date()
  })
})
```

## Figma Integration Guidelines

### Design-to-Code Workflow

1. **Design Tokens Sync**: Ensure Figma design tokens match the code implementation
2. **Component Mapping**: Map Figma components to React components using Code Connect
3. **Asset Export**: Use consistent naming and optimization for exported assets
4. **Responsive Variants**: Create Figma variants for different screen sizes

### Code Generation Rules

- **Replace Tailwind utilities** with project-specific design tokens when applicable
- **Reuse existing components** instead of generating new ones
- **Maintain visual parity** with Figma designs while following code standards
- **Use semantic HTML** and proper accessibility attributes

### Component Naming Convention

- Figma component names should match React component names
- Use PascalCase for component names (e.g., `ReportCard`, `TimeRangePicker`)
- Include variant information in component names (e.g., `ButtonPrimary`, `ButtonSecondary`)

## File Organization

```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── services/           # API and data services
├── design-tokens/      # Design system tokens
├── styles/             # Global styles and themes
└── pages/              # Page components and routing
```

## Development Guidelines

1. **Component Development**: Start with Figma designs, generate initial code, then refine
2. **Design Token Usage**: Always use design tokens instead of hardcoded values
3. **Accessibility First**: Include accessibility considerations from the start
4. **Performance**: Optimize for data-heavy interfaces with virtualization when needed
5. **Testing**: Include visual regression tests for design system components

## Integration with AVEVA Historian

**Data Display Patterns**:
- Real-time data updates with loading states
- Time-series chart optimizations for large datasets
- Professional report layouts suitable for industrial contexts
- Clear data quality indicators and error states

This design system ensures consistency between Figma designs and the implemented React application while maintaining the professional, data-focused nature required for industrial reporting applications.