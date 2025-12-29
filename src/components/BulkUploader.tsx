import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import Button from './ui/Button';
import Alert from './ui/Alert';

interface BulkUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onTemplateDownload?: () => void;
  maxRows?: number;
  acceptedColumns?: string[];
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

const DEFAULT_COLUMNS = [
  'address',
  'bedrooms',
  'bathrooms',
  'square_feet',
  'property_type',
  'amenities'
];

export default function BulkUploader({
  onUpload,
  onTemplateDownload,
  maxRows = 100,
  acceptedColumns = DEFAULT_COLUMNS
}: BulkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateCSV = useCallback((file: File): Promise<{ valid: boolean; errors: ValidationError[] }> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const errors: ValidationError[] = [];
          const rows = results.data as Record<string, string>[];
          
          // Check row count
          if (rows.length > maxRows) {
            errors.push({
              row: 0,
              column: 'file',
              message: `File contains ${rows.length} rows. Maximum allowed is ${maxRows}.`
            });
          }

          // Check for required columns
          const headers = results.meta.fields || [];
          const missingColumns = acceptedColumns.filter(col => 
            !headers.some(h => h.toLowerCase().replace(/\s+/g, '_') === col.toLowerCase())
          );

          if (missingColumns.length > 0) {
            errors.push({
              row: 0,
              column: 'headers',
              message: `Missing required columns: ${missingColumns.join(', ')}`
            });
          }

          // Validate each row
          rows.forEach((row, index) => {
            const rowNum = index + 2; // +2 because CSV is 1-indexed and has header

            if (!row.address || row.address.trim() === '') {
              errors.push({
                row: rowNum,
                column: 'address',
                message: 'Address is required'
              });
            }

            if (row.bedrooms && isNaN(Number(row.bedrooms))) {
              errors.push({
                row: rowNum,
                column: 'bedrooms',
                message: 'Bedrooms must be a number'
              });
            }

            if (row.bathrooms && isNaN(Number(row.bathrooms))) {
              errors.push({
                row: rowNum,
                column: 'bathrooms',
                message: 'Bathrooms must be a number'
              });
            }

            if (row.square_feet && isNaN(Number(row.square_feet))) {
              errors.push({
                row: rowNum,
                column: 'square_feet',
                message: 'Square feet must be a number'
              });
            }
          });

          resolve({ valid: errors.length === 0, errors });
        },
        error: (error) => {
          resolve({
            valid: false,
            errors: [{
              row: 0,
              column: 'file',
              message: `CSV parsing error: ${error.message}`
            }]
          });
        }
      });
    });
  }, [maxRows, acceptedColumns]);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setValidationErrors([{
        row: 0,
        column: 'file',
        message: 'Please select a CSV file'
      }]);
      setIsValid(false);
      return;
    }

    setSelectedFile(file);
    setIsValid(null);
    setValidationErrors([]);

    const validation = await validateCSV(file);
    setIsValid(validation.valid);
    setValidationErrors(validation.errors);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !isValid) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await onUpload(selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setSelectedFile(null);
        setIsValid(null);
        setValidationErrors([]);
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setIsValid(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = acceptedColumns.join(',');
    const exampleRow = acceptedColumns.map(col => {
      switch (col) {
        case 'address':
          return '123 Main St, Charleston, SC 29401';
        case 'bedrooms':
          return '3';
        case 'bathrooms':
          return '2.5';
        case 'square_feet':
          return '1800';
        case 'property_type':
          return 'Single Family Home';
        case 'amenities':
          return 'Pool, Garage, Ocean View';
        default:
          return '';
      }
    }).join(',');
    
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-upload-template.csv';
    a.click();
    URL.revokeObjectURL(url);

    if (onTemplateDownload) {
      onTemplateDownload();
    }
  };

  return (
    <div className="space-y-6">
      {onTemplateDownload && (
        <div className="flex justify-end">
          <Button
            variant="tertiary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition ${
          isDragging
            ? 'border-[#00f5ff] bg-[#00f5ff]/10 neon-glow-cyan'
            : 'border-gray-600 hover:border-[#00f5ff]/50 hover:bg-gray-700/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-[#00f5ff]' : 'text-gray-500'}`} />
            <p className="text-gray-300 font-medium mb-2">
              Drag and drop your CSV file here, or click to browse
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Maximum {maxRows} rows per file
            </p>
            <Button
              variant="neon-cyan"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose CSV File
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-blue-400" />
              <div className="text-left">
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-400">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {!isUploading && (
                <button
                  onClick={handleRemove}
                  className="ml-auto text-gray-400 hover:text-red-400 transition"
                  aria-label="Remove file"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#00f5ff] to-[#0066ff] h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400">Uploading... {uploadProgress}%</p>
              </div>
            )}

            {isValid === true && !isUploading && (
              <div className="flex items-center justify-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm">File validated successfully</span>
              </div>
            )}

            {isValid === false && (
              <Alert variant="error">
                <div>
                  <p className="font-semibold mb-2">Validation errors found:</p>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>
                        {error.row > 0 ? `Row ${error.row}` : ''} {error.column}: {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-gray-400">... and {validationErrors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              </Alert>
            )}

            {isValid === true && !isUploading && (
              <Button
                variant="neon-cyan"
                onClick={handleUpload}
                fullWidth
              >
                Upload & Process
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="text-sm text-gray-400 space-y-1">
        <p className="font-medium text-gray-300">Required columns:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          {acceptedColumns.map((col, idx) => (
            <li key={idx} className="capitalize">
              {col.replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

