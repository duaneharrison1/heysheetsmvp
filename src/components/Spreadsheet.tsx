import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpreadsheetData {
  [key: string]: any;
}

interface SpreadsheetProps {
  storeId: string;
  tabName: string;
  columns: { key: string; label: string; type?: 'text' | 'number' | 'email' | 'tel' }[];
  initialData?: SpreadsheetData[];
}

export function Spreadsheet({ storeId, tabName, columns, initialData = [] }: SpreadsheetProps) {
  const [data, setData] = useState<SpreadsheetData[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const { toast } = useToast();

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`store_${storeId}_${tabName}`);
    if (saved) {
      setData(JSON.parse(saved));
    } else if (initialData.length > 0) {
      setData(initialData);
    }
  }, [storeId, tabName, initialData]);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(`store_${storeId}_${tabName}`, JSON.stringify(data));
  }, [data, storeId, tabName]);

  const updateCell = useCallback((rowIndex: number, columnKey: string, value: string) => {
    setData(prev => {
      const newData = [...prev];
      newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
      return newData;
    });
    
    // Show auto-save indicator
    setTimeout(() => {
      toast({
        description: "Changes saved automatically",
        duration: 1000,
      });
    }, 300);
  }, [toast]);

  const addRow = () => {
    const newRow = columns.reduce((acc, col) => {
      acc[col.key] = '';
      return acc;
    }, {} as SpreadsheetData);
    setData(prev => [...prev, newRow]);
  };

  const deleteRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  const handleCellClick = (rowIndex: number, columnKey: string) => {
    setEditingCell({ row: rowIndex, col: columnKey });
  };

  const handleCellChange = (value: string) => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.col, value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnKey: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold capitalize">{tabName.replace(/([A-Z])/g, ' $1').trim()}</h3>
        <Button onClick={addRow} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Row
        </Button>
      </div>

      <div className="overflow-auto max-h-[600px]">
        <div className="min-w-full">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-0 border-b">
            <div className="spreadsheet-header w-12">#</div>
            <div className={`grid grid-cols-${columns.length} gap-0`}>
              {columns.map((col) => (
                <div key={col.key} className="spreadsheet-header">
                  {col.label}
                </div>
              ))}
            </div>
            <div className="spreadsheet-header w-12">Actions</div>
          </div>

          {/* Data Rows */}
          {data.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-[auto_1fr_auto] gap-0 hover:bg-muted/50">
              {/* Row number */}
              <div className="spreadsheet-header w-12 bg-muted/30 text-center">
                {rowIndex + 1}
              </div>
              
              {/* Data cells */}
              <div className={`grid grid-cols-${columns.length} gap-0`}>
                {columns.map((col) => (
                  <div key={col.key} className="relative">
                    {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                      <Input
                        type={col.type || 'text'}
                        value={row[col.key] || ''}
                        onChange={(e) => handleCellChange(e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                        className="spreadsheet-cell border-primary ring-2 ring-primary"
                        autoFocus
                      />
                    ) : (
                      <div
                        className="spreadsheet-cell cursor-pointer hover:bg-muted/50"
                        onClick={() => handleCellClick(rowIndex, col.key)}
                      >
                        {row[col.key] || ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Actions */}
              <div className="spreadsheet-header w-12 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRow(rowIndex)}
                  className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {/* Empty state */}
          {data.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="mb-4">No data yet. Click "Add Row" to get started.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}