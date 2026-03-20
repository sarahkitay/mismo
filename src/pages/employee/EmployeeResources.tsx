import { Card, CardContent } from '@/components/ui/card';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';

const resources = [
  {
    id: 'handbook',
    title: 'Employee Handbook',
    description: 'Complete guide to company policies, procedures, and expectations.',
    icon: 'resources' as const,
    color: 'blue',
    items: [
      { title: 'Code of Conduct', url: 'https://www.shrm.org/' },
      { title: 'Anti-Harassment Policy', url: 'https://www.eeoc.gov/harassment' },
      { title: 'Leave Policies', url: 'https://www.dol.gov/general/topic/benefits-leave' },
      { title: 'Remote Work Guidelines', url: 'https://www.osha.gov/heat-exposure/remote-work' },
    ],
  },
  {
    id: 'wellness',
    title: 'Wellness Resources',
    description: 'Mental health support, counseling services, and wellness programs.',
    icon: 'heartPulse' as const,
    color: 'green',
    items: [
      { title: 'Employee Assistance Program', url: 'https://www.samhsa.gov/find-help/national-helpline' },
      { title: 'Mental Health Hotline', url: 'https://988lifeline.org/' },
      { title: 'Wellness Workshops', url: 'https://www.cdc.gov/workplace-health-promotion/' },
      { title: 'Stress Management Guide', url: 'https://www.apa.org/topics/stress' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Security',
    description: 'Workplace safety protocols and emergency procedures.',
    icon: 'shield' as const,
    color: 'amber',
    items: [
      { title: 'Emergency Procedures', url: 'https://www.ready.gov/workplace-emergency-plans' },
      { title: 'Safety Training Materials', url: 'https://www.osha.gov/training' },
      { title: 'Incident Reporting Guide', url: 'https://www.osha.gov/workers/file-complaint' },
      { title: 'Evacuation Plans', url: 'https://www.osha.gov/etools/evacuation-plans-procedures' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal & Compliance',
    description: 'Information about your rights and legal protections.',
    icon: 'reports' as const,
    color: 'purple',
    items: [
      { title: 'Know Your Rights', url: 'https://www.dol.gov/general/aboutdol/majorlaws' },
      { title: 'Whistleblower Protection', url: 'https://www.whistleblowers.gov/' },
      { title: 'Equal Opportunity Policy', url: 'https://www.eeoc.gov/employers/small-business/overview-eeo-laws' },
      { title: 'Privacy Policy', url: 'https://www.ftc.gov/business-guidance/privacy-security' },
    ],
  },
  {
    id: 'support',
    title: 'Support Contacts',
    description: 'Get help from HR, IT, and other support teams.',
    icon: 'help' as const,
    color: 'teal',
    items: [
      { title: 'HR Contact Information', url: 'mailto:hr@mismo.com' },
      { title: 'IT Help Desk', url: 'mailto:it-help@mismo.com' },
      { title: 'Facilities Support', url: 'mailto:facilities@mismo.com' },
      { title: 'Ethics Hotline', url: 'https://www.lighthouse-services.com/' },
    ],
  },
  {
    id: 'training',
    title: 'Training & Development',
    description: 'Learning resources and professional development opportunities.',
    icon: 'target' as const,
    color: 'blue',
    items: [
      { title: 'Compliance Training', url: 'https://www.osha.gov/education-center' },
      { title: 'Leadership Development', url: 'https://www.coursera.org/browse/business/leadership-and-management' },
      { title: 'Skills Workshops', url: 'https://www.linkedin.com/learning/' },
      { title: 'Career Pathing Guide', url: 'https://www.onetonline.org/' },
    ],
  },
];

const hotlines = [
  {
    name: 'Employee Assistance Program',
    phone: '1-800-555-HELP',
    description: 'Confidential counseling and support services',
  },
  {
    name: 'Ethics Hotline',
    phone: '1-800-555-ETHICS',
    description: 'Report ethical concerns anonymously',
  },
  {
    name: 'Crisis Support Line',
    phone: '988',
    description: 'National Suicide & Crisis Lifeline',
  },
];

interface EmployeeResourcesProps {
  dataStore: DataStore;
}

export function EmployeeResources({ dataStore }: EmployeeResourcesProps) {
  const employeePolicies = dataStore.policies.filter((p) => p.status === 'PUBLISHED');
  const acknowledgedIds = new Set(
    dataStore.policyAcknowledgements
      .filter((ack) => ack.userId === dataStore.currentUser.id)
      .map((ack) => ack.policyId)
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="resources-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Resources</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Policy references, support channels, and compliance guidance.
        </p>
      </div>

      {/* Policies — read and unread */}
      {employeePolicies.length > 0 && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Policies</h2>
            <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Company policies you have read or need to acknowledge.</p>
            <ul className="mt-3 space-y-2">
              {employeePolicies.map((policy) => {
                const read = acknowledgedIds.has(policy.id);
                return (
                  <li
                    key={policy.id}
                    className="flex items-center justify-between py-2 border-b border-[var(--color-border-200)] last:border-0"
                  >
                    <span className="font-medium">{policy.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${read ? 'bg-[var(--mismo-green-light)] text-[var(--mismo-green)]' : 'bg-[var(--mismo-amber)]/20 text-[var(--mismo-amber)]'}`}>
                      {read ? 'I\'ve read and understood' : 'Needs acknowledgement'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      
      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {resources.map((resource) => {
          return (
            <Card
              key={resource.id}
              className="resource-card mismo-card mismo-card-hover cursor-pointer"
              onClick={() => window.open(resource.items[0].url, '_blank', 'noopener,noreferrer')}
            >
              <CardContent className="p-5">
                <h3 className="font-semibold text-[var(--mismo-text)] text-lg">{resource.title}</h3>
                <p className="text-sm text-[var(--mismo-text-secondary)] mt-1 mb-4">
                  {resource.description}
                </p>
                <ul className="space-y-2">
                  {resource.items.map((item, index) => (
                    <li key={index}>
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-sm text-[var(--mismo-blue)] hover:underline"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Emergency Hotlines */}
      <Card className="hotlines-card mismo-card border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-[var(--mismo-text)] text-lg">Emergency Support Hotlines</h3>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Available 24/7 for immediate assistance
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {hotlines.map((hotline) => (
              <a
                key={hotline.name}
                className="p-4 bg-red-50 border mismo-card-hover cursor-pointer"
                href={hotline.phone === '988' ? 'tel:988' : 'tel:+18005554357'}
              >
                <p className="font-medium text-[var(--mismo-text)]">{hotline.name}</p>
                <p className="text-lg font-bold text-red-600 mt-1">{hotline.phone}</p>
                <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
                  {hotline.description}
                </p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg">Policy Acknowledgements</h3>
          <div className="mt-4 space-y-3">
            {employeePolicies.map((policy) => (
              <div key={policy.id} className="flex items-center justify-between border p-3">
                <div>
                  <p className="font-medium">{policy.title}</p>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">{policy.type}</p>
                </div>
                {acknowledgedIds.has(policy.id) ? (
                  <span className="status-chip status-chip--success">Acknowledged</span>
                ) : (
                  <Button size="sm" onClick={() => dataStore.acknowledgePolicy(policy.id, dataStore.currentUser.id)}>
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
