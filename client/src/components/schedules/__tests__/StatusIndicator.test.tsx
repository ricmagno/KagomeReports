import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusIndicator, ScheduleStatus } from '../StatusIndicator';

describe('StatusIndicator', () => {
  describe('Status Types', () => {
    it('should render success status with green checkmark', () => {
      render(<StatusIndicator status="success" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('aria-label', 'Status: Success');
      
      // Check for success icon (green checkmark)
      const svg = statusElement.querySelector('svg');
      expect(svg).toHaveClass('text-green-600');
    });

    it('should render failed status with red X icon', () => {
      render(<StatusIndicator status="failed" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-label', 'Status: Failed');
      
      // Check for failed icon (red X)
      const svg = statusElement.querySelector('svg');
      expect(svg).toHaveClass('text-red-600');
    });

    it('should render running status with blue spinner', () => {
      render(<StatusIndicator status="running" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-label', 'Status: Running');
      
      // Check for running icon (blue spinner with animation)
      const svg = statusElement.querySelector('svg');
      expect(svg).toHaveClass('text-blue-600');
      expect(svg).toHaveClass('animate-spin');
    });

    it('should render disabled status with gray pause icon', () => {
      render(<StatusIndicator status="disabled" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-label', 'Status: Disabled');
      
      // Check for disabled icon (gray pause)
      const svg = statusElement.querySelector('svg');
      expect(svg).toHaveClass('text-gray-400');
    });
  });

  describe('Size Variations', () => {
    it('should render small size correctly', () => {
      render(<StatusIndicator status="success" size="sm" />);
      
      const svg = screen.getByRole('status').querySelector('svg');
      expect(svg).toHaveClass('w-4');
      expect(svg).toHaveClass('h-4');
    });

    it('should render medium size correctly (default)', () => {
      render(<StatusIndicator status="success" size="md" />);
      
      const svg = screen.getByRole('status').querySelector('svg');
      expect(svg).toHaveClass('w-5');
      expect(svg).toHaveClass('h-5');
    });

    it('should render large size correctly', () => {
      render(<StatusIndicator status="success" size="lg" />);
      
      const svg = screen.getByRole('status').querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('should default to medium size when size prop is not provided', () => {
      render(<StatusIndicator status="success" />);
      
      const svg = screen.getByRole('status').querySelector('svg');
      expect(svg).toHaveClass('w-5');
      expect(svg).toHaveClass('h-5');
    });
  });

  describe('Label Display', () => {
    it('should not show label by default', () => {
      render(<StatusIndicator status="success" />);
      
      // Label should be in sr-only span but not visible
      const srOnlyLabel = screen.getByText('Success', { selector: '.sr-only' });
      expect(srOnlyLabel).toBeInTheDocument();
      
      // Should not have visible label
      const visibleLabels = screen.queryAllByText('Success').filter(
        el => !el.classList.contains('sr-only')
      );
      expect(visibleLabels).toHaveLength(0);
    });

    it('should show label when showLabel is true', () => {
      render(<StatusIndicator status="success" showLabel={true} />);
      
      // Should have both sr-only and visible label
      const allLabels = screen.getAllByText('Success');
      expect(allLabels.length).toBeGreaterThan(1);
      
      // Check for visible label with correct styling
      const visibleLabel = allLabels.find(el => !el.classList.contains('sr-only'));
      expect(visibleLabel).toBeInTheDocument();
      expect(visibleLabel).toHaveClass('text-sm');
      expect(visibleLabel).toHaveClass('font-medium');
      expect(visibleLabel).toHaveClass('text-green-600');
    });

    it('should show correct label text for each status', () => {
      const statuses: Array<{ status: ScheduleStatus; label: string }> = [
        { status: 'success', label: 'Success' },
        { status: 'failed', label: 'Failed' },
        { status: 'running', label: 'Running' },
        { status: 'disabled', label: 'Disabled' },
      ];

      statuses.forEach(({ status, label }) => {
        const { unmount } = render(<StatusIndicator status={status} showLabel={true} />);
        
        const visibleLabel = screen.getAllByText(label).find(
          el => !el.classList.contains('sr-only')
        );
        expect(visibleLabel).toBeInTheDocument();
        
        unmount();
      });
    });

    it('should apply correct color to label based on status', () => {
      const { rerender } = render(<StatusIndicator status="success" showLabel={true} />);
      let visibleLabel = screen.getAllByText('Success').find(el => !el.classList.contains('sr-only'));
      expect(visibleLabel).toHaveClass('text-green-600');

      rerender(<StatusIndicator status="failed" showLabel={true} />);
      visibleLabel = screen.getAllByText('Failed').find(el => !el.classList.contains('sr-only'));
      expect(visibleLabel).toHaveClass('text-red-600');

      rerender(<StatusIndicator status="running" showLabel={true} />);
      visibleLabel = screen.getAllByText('Running').find(el => !el.classList.contains('sr-only'));
      expect(visibleLabel).toHaveClass('text-blue-600');

      rerender(<StatusIndicator status="disabled" showLabel={true} />);
      visibleLabel = screen.getAllByText('Disabled').find(el => !el.classList.contains('sr-only'));
      expect(visibleLabel).toHaveClass('text-gray-400');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<StatusIndicator status="success" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
    });

    it('should have descriptive aria-label', () => {
      render(<StatusIndicator status="success" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-label', 'Status: Success');
    });

    it('should have screen reader only text', () => {
      render(<StatusIndicator status="success" />);
      
      const srOnlyText = screen.getByText('Success', { selector: '.sr-only' });
      expect(srOnlyText).toBeInTheDocument();
    });

    it('should mark icon as aria-hidden', () => {
      render(<StatusIndicator status="success" />);
      
      const svg = screen.getByRole('status').querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<StatusIndicator status="success" className="custom-class" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveClass('custom-class');
    });

    it('should preserve default classes when custom className is provided', () => {
      render(<StatusIndicator status="success" className="custom-class" />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveClass('inline-flex');
      expect(statusElement).toHaveClass('items-center');
      expect(statusElement).toHaveClass('gap-2');
      expect(statusElement).toHaveClass('custom-class');
    });
  });
});
