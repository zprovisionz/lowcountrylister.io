import { Mail, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';

interface EmailConfirmationScreenProps {
  email: string;
  onBack?: () => void;
}

export default function EmailConfirmationScreen({
  email,
  onBack,
}: EmailConfirmationScreenProps) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-blue-400" />
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Check your email
        </h2>
        <p className="text-gray-300">
          We've sent a confirmation link to
        </p>
        <p className="text-blue-400 font-semibold mt-1">
          {email}
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-left">
        <p className="text-sm text-blue-300">
          <strong>Next steps:</strong>
        </p>
        <ol className="text-sm text-blue-200/80 mt-2 space-y-1 list-decimal list-inside">
          <li>Check your inbox for an email from Lowcountry Listings AI</li>
          <li>Click the confirmation link in the email</li>
          <li>Return here to sign in</li>
        </ol>
      </div>

      <div className="text-sm text-gray-400 space-y-2">
        <p>Didn't receive the email?</p>
        <ul className="space-y-1">
          <li>Check your spam/junk folder</li>
          <li>Make sure you entered the correct email address</li>
          <li>Wait a few minutes and try again</li>
        </ul>
      </div>

      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          icon={<ArrowLeft className="w-4 h-4" />}
          iconPosition="left"
        >
          Back to Sign In
        </Button>
      )}
    </div>
  );
}



