import React from 'react';
import { Link } from 'react-router-dom';
import { getRecentSessions } from '@/services/api';
import { Clock } from 'lucide-react';

export const RecentSessions: React.FC = () => {
  const sessions = getRecentSessions();

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Recent Sessions</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {sessions.map(sessionId => (
          <Link
            key={sessionId}
            to={`/session/${sessionId}`}
            className="text-sm px-3 py-1.5 rounded-md bg-muted hover:bg-accent transition-colors"
          >
            {sessionId}
          </Link>
        ))}
      </div>
    </div>
  );
};
