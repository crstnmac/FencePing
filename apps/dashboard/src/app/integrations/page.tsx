'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/Header';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function IntegrationsPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      router.push('/automations');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleRedirect = () => {
    router.push('/automations');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <Header title="Integrations" subtitle="This page has been moved to Automations" />

      <div className="flex-1 overflow-auto p-3">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-md flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-medium text-amber-900">
                Integrations have been consolidated into Automations
              </h3>
            </div>

            <p className="text-amber-800 mb-8 leading-relaxed">
              Webhook integrations, Slack notifications, Notion database updates, and all other
              integrations are now managed through the unified Automations page. This provides
              better organization and more powerful automation capabilities.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRedirect}
                className="inline-flex items-center gap-3 px-6 py-3 bg-neutral-900 text-white font-medium rounded-md hover:bg-neutral-800 transition-colors duration-150"
              >
                Go to Automations
                <ArrowRight className="h-5 w-5" />
              </button>

              <p className="text-sm text-amber-700">
                You will be redirected automatically in 3 seconds...
              </p>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-md p-3">
            <h4 className="text-lg font-medium text-neutral-900 mb-6">What changed?</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-neutral-600 leading-relaxed">
                  All webhook integrations are now automations with kind=&quot;webhook&quot;
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-neutral-600 leading-relaxed">
                  You can create rules to trigger automations based on geofence events
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-neutral-600 leading-relaxed">
                  Better organization with automation rules, delivery tracking, and templates
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-neutral-600 leading-relaxed">
                  Support for multiple integration types in one unified interface
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
