import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { ChevronLeft, Mail, Phone, MapPin, Calendar, ShoppingBag, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { clsx } from 'clsx'

export default function CustomerDetail() {
  const { id } = useParams()
  
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.customers.get(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!customer) {
    return <div className="p-8 text-center text-text-muted">Customer not found.</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back button */}
      <div>
        <Link to="/customers" className="inline-flex items-center text-sm font-medium text-text-muted hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Customers
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="space-y-6">
          <div className="card text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary-light to-primary opacity-20" />
            <div className="relative pt-6">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-md ring-4 ring-white mb-4">
                {customer.firstName[0]}{customer.lastName[0]}
              </div>
              <h1 className="text-xl font-bold text-text-primary">{customer.firstName} {customer.lastName}</h1>
              <p className="text-text-muted text-sm mt-1 mb-4">Customer since {format(new Date(customer.createdAt), 'MMM yyyy')}</p>
              
              <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                {customer.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-light text-primary border border-primary/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-left border-t border-border pt-4">
              <div className="flex items-center text-sm"><Mail className="w-4 h-4 text-text-muted mr-3" /> <span className="text-text-primary truncate">{customer.email}</span></div>
              <div className="flex items-center text-sm"><Phone className="w-4 h-4 text-text-muted mr-3" /> <span className="text-text-primary">{customer.phone || '—'}</span></div>
              <div className="flex items-center text-sm"><MapPin className="w-4 h-4 text-text-muted mr-3" /> <span className="text-text-primary">{customer.city || '—'}</span></div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-bold text-text-primary">Value Summary</h3>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm text-text-muted">Total Spend</span>
              <span className="font-semibold text-emerald-600">₹{customer.totalSpend.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm text-text-muted">Total Orders</span>
              <span className="font-semibold text-text-primary">{customer.orderCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-muted">Avg Order Value</span>
              <span className="font-semibold text-text-primary">₹{customer.orderCount > 0 ? Math.round(customer.totalSpend / customer.orderCount).toLocaleString('en-IN') : 0}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Order History */}
        <div className="md:col-span-2 space-y-6">
          <div className="card h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> Purchase History
              </h2>
              <div className="text-sm text-text-muted">
                Last ordered {customer.lastOrderAt ? formatDistanceToNow(new Date(customer.lastOrderAt), { addSuffix: true }) : 'never'}
              </div>
            </div>

            {customer.orders && customer.orders.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[19px] before:w-[2px] before:bg-gray-100">
                {customer.orders.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()).map((order) => (
                  <div key={order.id} className="relative flex gap-4 items-start pl-1">
                    <div className="w-10 h-10 rounded-full bg-surface border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10 text-xl">
                      🛍️
                    </div>
                    <div className="flex-1 bg-surface border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-text-primary text-sm flex items-center gap-2">
                            Order {order.orderNumber}
                            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider', 
                              order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                              order.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-200 text-gray-700'
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-text-muted mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {format(new Date(order.orderedAt), 'dd MMM yyyy, h:mm a')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">₹{order.amount.toLocaleString('en-IN')}</div>
                          {order.channel && <div className="text-xs text-text-muted mt-0.5">via {order.channel}</div>}
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
                        {order.items.map((item, idx) => (
                          <span key={idx} className="bg-white border border-border px-2 py-1 rounded text-xs text-text-muted">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-text-muted bg-surface rounded-xl border border-dashed border-border">
                <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p>No orders placed yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}