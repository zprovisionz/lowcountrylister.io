interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrength(password);
  const percentage = (strength.score / 5) * 100;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Password strength:</span>
        <span className={`font-medium ${strength.color.replace('bg-', 'text-')}`}>
          {strength.label}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`${strength.color} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={strength.score}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label={`Password strength: ${strength.label}`}
        />
      </div>
      {password.length > 0 && password.length < 6 && (
        <p className="text-xs text-gray-400 mt-1">
          Password must be at least 6 characters long
        </p>
      )}
    </div>
  );
}

