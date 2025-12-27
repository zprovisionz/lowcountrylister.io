import { X, Check } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  if (!isOpen) return null;

  const plans = [
    {
      name: 'Starter',
      price: 10,
      features: [
        '50 generations per month',
        'MLS & Airbnb descriptions',
        'Social media captions',
        'No watermark',
        'Email support',
      ],
    },
    {
      name: 'Pro',
      price: 19,
      popular: true,
      features: [
        'Unlimited generations',
        'MLS & Airbnb descriptions',
        'Social media captions',
        'No watermark',
        'Priority email support',
        'Advanced AI features',
        'Custom branding',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700/50 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Upgrade Your Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 md:p-8">
          <p className="text-center text-gray-300 mb-8">
            Choose the plan that fits your needs and unlock unlimited Charleston listing magic
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl p-6 border-2 transition ${
                  plan.popular
                    ? 'border-blue-500 shadow-xl bg-gray-700/30'
                    : 'border-gray-600 hover:border-blue-400 bg-gray-700/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                      : 'bg-gray-600 text-white hover:bg-gray-500'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              All plans include a 7-day free trial. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
