# Historian Reports - Frontend

This is the React.js frontend application for the Historian Reports system, providing a professional web interface for generating reports from AVEVA Historian database.

## Features

- **Dashboard Interface**: Clean, professional dashboard for report configuration
- **Time Range Selection**: Calendar widgets with preset time periods (1h, 24h, 7d, 30d)
- **Tag Selection**: Interactive tag browser with search and filtering
- **Report Configuration**: Visual report builder with chart type selection
- **Responsive Design**: Mobile-first design that works on all screen sizes
- **Professional Styling**: Industrial-grade UI following design system guidelines

## Technology Stack

- **React.js 19** with TypeScript for type safety
- **Tailwind CSS 3** for utility-first styling
- **Chart.js** for data visualization
- **Lucide React** for consistent iconography
- **React Hook Form** for form management
- **Zod** for runtime type validation

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The application will start on http://localhost:3001 (or next available port).

### Environment Variables

Create a `.env` file in the client directory:

```env
REACT_APP_API_URL=http://localhost:3000/api
PORT=3001
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Basic UI components (Button, Input, Card, etc.)
│   ├── forms/          # Form components (TimeRangePicker, TagSelector)
│   ├── charts/         # Data visualization components
│   └── layout/         # Layout components (Dashboard, Header, etc.)
├── design-tokens/      # Design system tokens (colors, typography, spacing)
├── services/           # API service layer
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── styles/             # Global styles and CSS
└── tests/              # Test files including property-based tests
```

## Design System

The application follows a comprehensive design system with:

- **Color Palette**: Professional blue primary colors with semantic colors for data visualization
- **Typography**: Inter font family with consistent sizing scale
- **Spacing**: 8px base unit with consistent spacing scale
- **Components**: Reusable UI components with consistent styling
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation and screen reader support

## API Integration

The frontend communicates with the backend API running on port 3000:

- **Data Endpoints**: Retrieve tags, time-series data, statistics, and trends
- **Report Endpoints**: Save, load, and generate reports
- **Health Checks**: Monitor system status

## Testing

The application includes comprehensive testing:

```bash
# Run all tests
npm test

# Run property-based tests
npm test -- --testNamePattern="Property"

# Run specific test file
npm test -- report-configuration.property.test.ts
```

### Property-Based Testing

The application uses FastCheck for property-based testing to validate:

- Report configuration round-trip consistency
- Data serialization/deserialization
- Configuration uniqueness and completeness
- Edge case handling

## Building for Production

```bash
# Build the application
npm run build
```

The build artifacts will be created in the `build/` directory.

## Development Guidelines

1. **Component Development**: Follow the design system patterns
2. **Type Safety**: Use TypeScript for all components and services
3. **Accessibility**: Include ARIA labels and keyboard navigation
4. **Performance**: Optimize for data-heavy interfaces
5. **Testing**: Include property-based tests for critical functionality

## Integration with Backend

The frontend is designed to work seamlessly with the Historian Reports backend:

- Automatic API error handling and retry logic
- Real-time data updates for auto-refresh functionality
- Professional report generation and download
- Scheduled report management

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and patterns
2. Include TypeScript types for all new code
3. Add property-based tests for critical functionality
4. Ensure accessibility compliance
5. Test on multiple screen sizes and browsers