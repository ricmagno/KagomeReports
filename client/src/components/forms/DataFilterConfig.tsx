import React from 'react';
import { Plus, Trash2, Filter, Layers, Zap } from 'lucide-react';
import { FilterCondition, LogicalOperator, ComparisonOperator } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

interface DataFilterConfigProps {
  filters?: FilterCondition;
  onChange: (filters: FilterCondition | undefined) => void;
  className?: string;
}

const LOGICAL_OPERATORS: LogicalOperator[] = ['AND', 'OR', 'NOR', 'NOT'];
const COMPARISON_OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: 'EQ', label: '=' },
  { value: 'GT', label: '>' },
  { value: 'LT', label: '<' },
  { value: 'GTE', label: '>=' },
  { value: 'LTE', label: '<=' },
  { value: 'NEQ', label: '!=' },
];

export const DataFilterConfig: React.FC<DataFilterConfigProps> = ({
  filters,
  onChange,
  className
}) => {
  const handleAddRoot = () => {
    onChange({
      logicalOperator: 'AND',
      conditions: []
    });
  };

  const handleUpdate = (newNode: FilterCondition) => {
    onChange(newNode);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all filters?')) {
      onChange(undefined);
    }
  };

  return (
    <Card className={cn("overflow-hidden border-gray-200 shadow-sm", className)}>
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Advanced Data Filters</h3>
        </div>
        {filters && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear Filters
          </Button>
        )}
      </div>
      <CardContent className="p-4">
        {!filters ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-4">No advanced filters configured.</p>
            <Button onClick={handleAddRoot} size="sm" className="bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Filter Group
            </Button>
          </div>
        ) : (
          <FilterNode 
            node={filters} 
            onUpdate={handleUpdate} 
            onDelete={() => onChange(undefined)} 
            depth={0} 
          />
        )}
        {filters && (
          <p className="mt-4 text-[10px] text-gray-400 italic">
            Note: Filters are applied to the data values after tag and quality filtering.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const FilterNode: React.FC<{
  node: FilterCondition;
  onUpdate: (newNode: FilterCondition) => void;
  onDelete: () => void;
  depth: number;
}> = ({ node, onUpdate, onDelete, depth }) => {
  const isGroup = !!node.logicalOperator;

  const handleAddCondition = () => {
    if (!node.conditions) return;
    onUpdate({
      ...node,
      conditions: [
        ...node.conditions,
        {
          comparison: { operator: 'GT', value: 0 }
        }
      ]
    });
  };

  const handleAddGroup = () => {
    if (!node.conditions) return;
    onUpdate({
      ...node,
      conditions: [
        ...node.conditions,
        {
          logicalOperator: 'AND',
          conditions: []
        }
      ]
    });
  };

  const handleUpdateChild = (index: number, newChild: FilterCondition) => {
    if (!node.conditions) return;
    const newConditions = [...node.conditions];
    newConditions[index] = newChild;
    onUpdate({ ...node, conditions: newConditions });
  };

  const handleDeleteChild = (index: number) => {
    if (!node.conditions) return;
    const newConditions = node.conditions.filter((_, i) => i !== index);
    onUpdate({ ...node, conditions: newConditions });
  };

  if (isGroup) {
    return (
      <div className={cn(
        "space-y-3 p-3 rounded-lg border",
        depth === 0 ? "border-primary-100 bg-primary-50/20" : "border-gray-200 bg-white"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className={cn("w-3.5 h-3.5", depth === 0 ? "text-primary-600" : "text-gray-400")} />
            <select
              value={node.logicalOperator}
              onChange={(e) => onUpdate({ ...node, logicalOperator: e.target.value as LogicalOperator })}
              className="text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer text-primary-700 hover:text-primary-800"
            >
              {LOGICAL_OPERATORS.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" onClick={handleAddCondition} className="h-7 text-[10px] px-2">
              <Zap className="w-3 h-3 mr-1" />
              Condition
            </Button>
            <Button variant="ghost" size="sm" onClick={handleAddGroup} className="h-7 text-[10px] px-2">
              <Plus className="w-3 h-3 mr-1" />
              Group
            </Button>
            {depth > 0 && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3 pl-2 border-l-2 border-primary-100 ml-1.5">
          {node.conditions?.map((child, index) => (
            <FilterNode
              key={index}
              node={child}
              onUpdate={(newNode) => handleUpdateChild(index, newNode)}
              onDelete={() => handleDeleteChild(index)}
              depth={depth + 1}
            />
          ))}
          {(!node.conditions || node.conditions.length === 0) && (
            <p className="text-[10px] text-gray-400 italic py-1">Empty group - will evaluate to TRUE</p>
          )}
        </div>
      </div>
    );
  }

  // Comparison Node
  return (
    <div className="flex items-center space-x-2 bg-white p-2 rounded border border-gray-200 shadow-sm animate-in fade-in slide-in-from-left-1 duration-200">
      <div className="w-2 h-2 rounded-full bg-primary-400" />
      <span className="text-xs font-medium text-gray-500 min-w-[40px]">Value</span>
      <select
        value={node.comparison?.operator}
        onChange={(e) => onUpdate({ 
          ...node, 
          comparison: { ...node.comparison!, operator: e.target.value as ComparisonOperator } 
        })}
        className="text-xs border-gray-300 rounded px-1.5 py-1 focus:ring-primary-500 focus:border-primary-500"
      >
        {COMPARISON_OPERATORS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <Input
        type="number"
        value={node.comparison?.value}
        onChange={(e) => onUpdate({ 
          ...node, 
          comparison: { ...node.comparison!, value: parseFloat(e.target.value) || 0 } 
        })}
        className="h-8 text-xs w-24"
        placeholder="Value"
      />
      <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};
