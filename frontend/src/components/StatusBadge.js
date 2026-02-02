import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const StatusBadge = ({ status, size = 'default' }) => {
  const { t } = useTranslation();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    default: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const statusConfig = {
    green: {
      label: t('valid'),
      icon: CheckCircle,
      classes: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    yellow: {
      label: t('warning'),
      icon: AlertTriangle,
      classes: 'bg-amber-100 text-amber-800 border-amber-300'
    },
    red: {
      label: t('expired'),
      icon: XCircle,
      classes: 'bg-red-100 text-red-800 border-red-300'
    },
    valid: {
      label: t('valid'),
      icon: CheckCircle,
      classes: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    warning: {
      label: t('warning'),
      icon: AlertTriangle,
      classes: 'bg-amber-100 text-amber-800 border-amber-300'
    },
    expired: {
      label: t('expired'),
      icon: XCircle,
      classes: 'bg-red-100 text-red-800 border-red-300'
    }
  };

  const config = statusConfig[status] || statusConfig.green;
  const Icon = config.icon;

  return (
    <span 
      className={`inline-flex items-center gap-2 font-medium rounded-md border-2 ${sizeClasses[size]} ${config.classes} uppercase tracking-wide`}
      data-testid={`status-badge-${status}`}
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
};

export default StatusBadge;