import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchedulesErrorBoundary } from '../SchedulesErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('SchedulesErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    render(
      <SchedulesErrorBoundary>
        <div>Test content</div>
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render error UI when an error is thrown', () => {
    render(
      <SchedulesErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An error occurred while loading the schedules section/)).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(
      <SchedulesErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should have Try Again button', () => {
    render(
      <SchedulesErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should have Reload Page button', () => {
    render(
      <SchedulesErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should have Try Again and Reload Page buttons', () => {
    render(
      <SchedulesErrorBoundary>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <SchedulesErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </SchedulesErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
