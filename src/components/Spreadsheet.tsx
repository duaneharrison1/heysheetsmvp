import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Grid, Save } from "lucide-react";
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
  const [data, setData] = useState<SpreadsheetData[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();

  const storageKey = `spreadsheet_${storeId}_${tabName}`;

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsedData = JSON.parse(saved);
        setData(parsedData);
        console.log(`Loaded ${parsedData.length} rows for ${storageKey}`);
      } else if (initialData.length > 0) {
        setData(initialData);
        // Save initial data
        localStorage.setItem(storageKey, JSON.stringify(initialData));
        console.log(`Initialized ${initialData.length} rows for ${storageKey}`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setData(initialData);
    }
  }, [storeId, tabName, storageKey]);

  // Auto-save to localStorage whenever data changes with debouncing
  useEffect(() => {
    if (data.length === 0 && initialData.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        setLastSaved(new Date());
        console.log(`Saved ${data.length} rows for ${storageKey}`);
      } catch (error) {
        console.error('Error saving data:', error);
        toast({
          title: "Save Error",
          description: "Failed to save changes. Please try again.",
          variant: "destructive",
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [data, storageKey, toast]);

  const updateCell = useCallback((rowIndex: number, columnKey: string, value: string) => {
    setData(prev => {
      const newData = [...prev];
      if (!newData[rowIndex]) {
        newData[rowIndex] = {};
      }
      newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
      return newData;
    });
  }, []);

  const saveData = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      setLastSaved(new Date());
      toast({
        description: "Changes saved successfully",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error saving data:', error);
      toast({
        title: "Save Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  }, [data, storageKey, toast]);

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
    <div className="bg-background border border-border rounded-lg overflow-hidden shadow-[var(--shadow-spreadsheet)]">
      {/* Toolbar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold capitalize text-foreground">
              {tabName.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
          </div>
          {lastSaved && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="w-3 h-3" />
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={saveData} variant="outline" size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
          <Button onClick={addRow} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Row
          </Button>
        </div>
      </div>

      {/* Spreadsheet Container */}
      <div className="bg-background">
        {/* Column Headers */}
        <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border">
          <div className="flex">
            {/* Empty corner cell */}
            <div className="w-12 h-10 bg-muted border-r border-border flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">#</span>
            </div>
            {/* Column headers */}
            {columns.map((col, index) => (
              <div 
                key={col.key} 
                className="min-w-[120px] h-10 bg-muted border-r border-border flex items-center px-3 font-medium text-sm text-muted-foreground hover:bg-muted/80"
                style={{ width: col.key === 'description' || col.key === 'notes' ? '200px' : '120px' }}
              >
                <span className="text-xs font-bold text-muted-foreground mr-2">
                  {String.fromCharCode(65 + index)}
                </span>
                {col.label}
              </div>
            ))}
            {/* Actions header */}
            <div className="w-16 h-10 bg-muted border-r border-border flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">Actions</span>
            </div>
          </div>
        </div>

        {/* Data Rows */}
        <div className="overflow-auto max-h-[500px]">
          {data.map((row, rowIndex) => (
            <div key={rowIndex} className="flex hover:bg-muted/30">
              {/* Row number */}
              <div className="w-12 bg-muted/50 border-r border-b border-border flex items-center justify-center text-xs font-medium text-muted-foreground min-h-[36px]">
                {rowIndex + 1}
              </div>
              
              {/* Data cells */}
              {columns.map((col) => (
                <div 
                  key={col.key} 
                  className="min-w-[120px] border-r border-b border-border min-h-[36px] relative"
                  style={{ width: col.key === 'description' || col.key === 'notes' ? '200px' : '120px' }}
                >
                  {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                    <Input
                      type={col.type || 'text'}
                      value={row[col.key] || ''}
                      onChange={(e) => handleCellChange(e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                      className="h-[36px] border-0 rounded-none bg-background focus:ring-2 focus:ring-primary focus:z-10 relative"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="h-[36px] px-3 py-2 cursor-pointer hover:bg-accent/50 flex items-center text-sm leading-tight"
                      onClick={() => handleCellClick(rowIndex, col.key)}
                      title={row[col.key] || 'Click to edit'}
                    >
                      <span className="truncate">{row[col.key] || ''}</span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Actions */}
              <div className="w-16 border-r border-b border-border flex items-center justify-center min-h-[36px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteRow(rowIndex)}
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          
          {/* Empty state */}
          {data.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Grid className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">No data yet</p>
              <p className="text-sm">Click "Add Row" to start adding data to your spreadsheet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}