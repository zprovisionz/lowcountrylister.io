import { useState } from 'react';
import { X, Mail, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
  teamName?: string;
}

export default function InviteModal({
  isOpen,
  onClose,
  onInvite,
  teamName
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await onInvite(email);
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-md w-full p-6 relative animate-scaleIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Invite Team Member</h2>
          {teamName && (
            <p className="text-sm text-gray-400">Add a member to {teamName}</p>
          )}
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {success && (
          <div className="mb-4">
            <Alert variant="success">
              Invitation sent successfully!
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00f5ff] focus:border-transparent neon-input"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="tertiary"
              onClick={onClose}
              fullWidth
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="neon-cyan"
              fullWidth
              isLoading={isLoading}
            >
              Send Invitation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

