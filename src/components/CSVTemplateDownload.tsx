import { Download } from 'lucide-react';
import Button from './ui/Button';

interface CSVTemplateDownloadProps {
  columns?: string[];
  onDownload?: () => void;
}

export default function CSVTemplateDownload({
  columns = ['address', 'bedrooms', 'bathrooms', 'square_feet', 'property_type', 'amenities'],
  onDownload
}: CSVTemplateDownloadProps) {
  const handleDownload = () => {
    const headers = columns.join(',');
    const exampleRow = columns.map(col => {
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

    if (onDownload) {
      onDownload();
    }
  };

  return (
    <Button
      variant="tertiary"
      size="sm"
      icon={<Download className="w-4 h-4" />}
      onClick={handleDownload}
    >
      Download Template
    </Button>
  );
}

