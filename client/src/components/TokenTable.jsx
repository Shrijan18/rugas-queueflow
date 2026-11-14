import React from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  XCircle, 
  Clock, 
  Phone, 
  User, 
  Hash, 
  AlertCircle 
} from 'lucide-react';

const statusBadgeStyles = {
  WAITING: 'bg-amber-50 text-amber-700 border-amber-200',
  SERVING: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const TokenTable = ({ 
  tokens = [], 
  onMoveUp, 
  onMoveDown, 
  onCancel, 
  isLoading = false 
}) => {
  if (tokens.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Waiting Tokens</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          The waiting queue is currently clear. Click "Add Person" above to issue a new token.
        </p>
      </div>
    );
  }

  const waitingTokens = tokens.filter((t) => t.status === 'WAITING');
  const maxPosition = waitingTokens.length > 0 
    ? Math.max(...waitingTokens.map((t) => t.position || 0))
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-5 py-3.5">Token</th>
              <th scope="col" className="px-5 py-3.5">Person</th>
              <th scope="col" className="px-5 py-3.5">Position</th>
              <th scope="col" className="px-5 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5">Est. Wait</th>
              <th scope="col" className="px-5 py-3.5 text-right">Reorder & Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {tokens.map((token) => {
              const isWaiting = token.status === 'WAITING';
              const isFirst = token.position === 1;
              const isLast = token.position === maxPosition;

              return (
                <tr 
                  key={token.id} 
                  className={`hover:bg-slate-50/80 transition-colors ${
                    token.status === 'SERVING' ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* Token Number */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200">
                      {token.token_number}
                    </span>
                  </td>

                  {/* Person & Phone */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-semibold text-slate-900">{token.person_name}</div>
                      {token.phone_number ? (
                        <div className="text-xs text-slate-400 flex items-center mt-0.5">
                          <Phone className="w-3 h-3 mr-1" />
                          {token.phone_number}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No phone</span>
                      )}
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {isWaiting ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        {token.position}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span 
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        statusBadgeStyles[token.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {token.status}
                    </span>
                  </td>

                  {/* Estimated Wait */}
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                    {isWaiting ? (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {token.estimated_waiting_minutes > 0 
                            ? `~${token.estimated_waiting_minutes} mins` 
                            : 'Next in line'}
                        </span>
                      </div>
                    ) : token.status === 'COMPLETED' ? (
                      <span className="text-emerald-600 font-medium">Completed</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Actions: Move Up, Move Down, Cancel */}
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    {isWaiting ? (
                      <div className="inline-flex items-center space-x-1.5">
                        {/* Move Up */}
                        <button
                          onClick={() => onMoveUp(token.id)}
                          disabled={isFirst || isLoading}
                          title={isFirst ? "First token cannot move up" : "Move Up in queue"}
                          className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                            isFirst || isLoading
                              ? 'opacity-30 border-slate-200 text-slate-300 cursor-not-allowed'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          onClick={() => onMoveDown(token.id)}
                          disabled={isLast || isLoading}
                          title={isLast ? "Last token cannot move down" : "Move Down in queue"}
                          className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                            isLast || isLoading
                              ? 'opacity-30 border-slate-200 text-slate-300 cursor-not-allowed'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 cursor-pointer'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Cancel Button */}
                        <button
                          onClick={() => onCancel(token)}
                          disabled={isLoading}
                          title="Cancel Token"
                          className={`p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 active:scale-95 transition-all ml-1 ${
                            isLoading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No actions</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TokenTable;

