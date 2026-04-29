import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AdminSystemHealthProps {
  dataStore: DataStore;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  description: string;
  lastChecked: string;
  icon: keyof typeof Icons;
}

export function AdminSystemHealth({ dataStore }: AdminSystemHealthProps) {
  const { dashboardCounts } = dataStore;
  
  // Mock service statuses
  const services: ServiceStatus[] = [
    {
      name: 'Database Connection',
      status: 'healthy',
      description: 'All database connections operational',
      lastChecked: 'Just now',
      icon: 'database',
    },
    {
      name: 'Email Service',
      status: 'healthy',
      description: 'Email delivery working normally',
      lastChecked: '1 min ago',
      icon: 'mail',
    },
    {
      name: 'SMS Service',
      status: 'healthy',
      description: 'SMS gateway connected',
      lastChecked: '2 min ago',
      icon: 'smartphone',
    },
    {
      name: 'File Storage',
      status: 'healthy',
      description: 'Attachment storage operational',
      lastChecked: '3 min ago',
      icon: 'upload',
    },
    {
      name: 'Authentication',
      status: 'healthy',
      description: 'Login system operational',
      lastChecked: 'Just now',
      icon: 'lock',
    },
    {
      name: 'Scheduled Tasks',
      status: 'healthy',
      description: `${dashboardCounts.activeCampaigns} active prompts running`,
      lastChecked: '5 min ago',
      icon: 'clock',
    },
  ];
  
  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-[var(--color-surface-100)] text-[var(--color-text-primary)] border-[var(--color-border-200)]';
      case 'degraded':
        return 'bg-[var(--color-surface-100)] text-[var(--color-text-primary)] border-[var(--color-border-200)]';
      case 'down':
        return 'bg-[var(--color-surface-100)] text-[var(--color-text-primary)] border-[var(--color-border-200)]';
    }
  };
  
  const getStatusBadge = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge className="status-chip status-chip--success">Healthy</Badge>;
      case 'degraded':
        return <Badge className="status-chip status-chip--warn">Degraded</Badge>;
      case 'down':
        return <Badge className="status-chip status-chip--alert">Down</Badge>;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="health-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">System Health</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Monitor system status and service availability
        </p>
      </div>
      
      {/* Overall Status */}
      <Card className="status-card mismo-card border-l-4 border-l-[var(--color-emerald-600)]">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[var(--radius-medium)] bg-[var(--color-surface-200)] flex items-center justify-center">
              <Icons.checkCircle className="h-7 w-7 text-[var(--color-emerald-600)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--mismo-text)]">
                All Systems Operational
              </h2>
              <p className="text-[var(--mismo-text-secondary)]">
                All services are running normally. Last updated: Just now
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => {
          const Icon = Icons[service.icon];
          
          return (
            <Card key={service.name} className={`status-card mismo-card border ${getStatusColor(service.status)}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      service.status === 'healthy' ? 'bg-[var(--color-surface-200)]' :
                      service.status === 'degraded' ? 'bg-[var(--color-surface-200)]' :
                      'bg-[var(--color-surface-200)]'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        service.status === 'healthy' ? 'text-[var(--color-emerald-600)]' :
                        service.status === 'degraded' ? 'text-[#8a6510]' :
                        'text-[var(--color-alert-600)]'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--mismo-text)]">{service.name}</h3>
                      <p className="text-sm text-[var(--mismo-text-secondary)] mt-0.5">
                        {service.description}
                      </p>
                      <p className="text-xs text-[var(--mismo-text-secondary)] mt-2">
                        Last checked: {service.lastChecked}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* System Metrics */}
      <Card className="status-card mismo-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-[var(--mismo-text)] mb-4">System Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-[var(--color-surface-200)] rounded-[var(--radius-medium)]">
              <p className="text-2xl font-bold text-[var(--mismo-text)]">99.9%</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Uptime</p>
            </div>
            <div className="text-center p-4 bg-[var(--color-surface-200)] rounded-[var(--radius-medium)]">
              <p className="text-2xl font-bold text-[var(--mismo-text)]">45ms</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Avg Response</p>
            </div>
            <div className="text-center p-4 bg-[var(--color-surface-200)] rounded-[var(--radius-medium)]">
              <p className="text-2xl font-bold text-[var(--mismo-text)]">2.1GB</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Storage Used</p>
            </div>
            <div className="text-center p-4 bg-[var(--color-surface-200)] rounded-[var(--radius-medium)]">
              <p className="text-2xl font-bold text-[var(--mismo-text)]">1,234</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">API Calls/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Incident History */}
      <Card className="status-card mismo-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-[var(--mismo-text)] mb-4">Recent Incidents</h3>
          <div className="text-center py-8">
            <Icons.checkCircle className="h-12 w-12 text-[var(--color-emerald-600)] mx-auto mb-3" />
            <p className="text-[var(--mismo-text-secondary)]">
              No incidents in the last 30 days
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
