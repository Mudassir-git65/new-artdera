import { useState, useEffect } from "react";
import {
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  Eye,
  ShieldAlert,
  Loader2,
  Mail,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AccountDeletionService } from "./services";
import type { AccountDeletionRequest } from "./types";
import { AdminPanel } from "./admin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AccountDeletionQueue() {
  const [requests, setRequests] = useState<AccountDeletionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<AccountDeletionRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Execute deletion dialog state
  const [executeRequest, setExecuteRequest] = useState<AccountDeletionRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // Status update modal state
  const [updateRequest, setUpdateRequest] = useState<AccountDeletionRequest | null>(null);
  const [newStatus, setNewStatus] = useState<AccountDeletionRequest["status"]>("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await AccountDeletionService.listRequests(page, statusFilter, query);
      if (res.data) {
        setRequests(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages || 1);
      } else {
        setRequests([]);
        setTotal(0);
        setPages(1);
        setErrorMsg(res.error?.message || "Failed to load deletion requests");
      }
    } catch {
      setErrorMsg("An unexpected error occurred while fetching deletion requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRequests();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, statusFilter, query]);

  const handleExecuteDeletion = async () => {
    if (!executeRequest) return;
    setIsExecuting(true);
    try {
      const res = await AccountDeletionService.executeDeletion(executeRequest.id, adminNotes);
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success("User account and associated data deleted successfully.");
        setExecuteRequest(null);
        setAdminNotes("");
        void fetchRequests();
      }
    } catch {
      toast.error("Failed to execute account deletion.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updateRequest) return;
    if (newStatus === "rejected" && !rejectionReason.trim()) {
      return toast.error("Please provide a rejection reason.");
    }

    setIsUpdatingStatus(true);
    try {
      const res = await AccountDeletionService.updateStatus(
        updateRequest.id,
        newStatus,
        adminNotes,
        rejectionReason.trim() || undefined,
      );
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success(`Request status updated to ${newStatus}.`);
        setUpdateRequest(null);
        setRejectionReason("");
        setAdminNotes("");
        void fetchRequests();
      }
    } catch {
      toast.error("Failed to update request status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: AccountDeletionRequest["status"]) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"><Clock className="h-3 w-3" /> Pending</span>;
      case "processing":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800"><Loader2 className="h-3 w-3 animate-spin" /> Processing</span>;
      case "completed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Completed</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800"><XCircle className="h-3 w-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <AdminPanel>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="eyebrow">Google Play Store Compliance</div>
            <h2 className="mt-1 font-display text-3xl">Account Deletion Requests</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review deletion requests submitted via /delete-account or mobile app. Approve and permanently delete after identity verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
                className="art-field pl-10 text-xs w-full"
                placeholder="Search name or email..."
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-5 flex gap-2 border-b border-[var(--color-border)] pb-3 overflow-x-auto">
          {[
            ["All Requests", "all"],
            ["Pending Review", "pending"],
            ["Processing", "processing"],
            ["Completed", "completed"],
            ["Rejected", "rejected"],
          ].map(([label, key]) => (
            <button
              key={key}
              onClick={() => {
                setPage(1);
                setStatusFilter(key);
              }}
              className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition ${
                statusFilter === key
                  ? "bg-[var(--oxblood)] text-white"
                  : "bg-[var(--ivory)] text-muted-foreground hover:bg-[var(--ink)] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Request Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="p-3">Requested Date</th>
                <th className="p-3">User Details</th>
                <th className="p-3">Matched User Account</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--oxblood)] mb-2" />
                    Loading account deletion requests...
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-red-600">
                    {errorMsg}
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-[var(--ivory)]/50 transition">
                    <td className="p-3 text-xs">
                      <div>{new Date(item.createdAt).toLocaleDateString("en-PK")}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">ID: {item.id.slice(-6)}</div>
                    </td>

                    <td className="p-3">
                      <strong className="text-sm">{item.name}</strong>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {item.email}
                      </div>
                    </td>

                    <td className="p-3 text-xs">
                      {item.user ? (
                        <div className="rounded-lg bg-[var(--ivory)] p-2 border border-[var(--color-border)]">
                          <div className="font-semibold text-xs capitalize">{item.user.fullName} ({item.user.role})</div>
                          <div className="text-[10px] text-muted-foreground">Status: {item.user.status || "active"}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No matching account</span>
                      )}
                    </td>

                    <td className="p-3 text-xs max-w-[200px] truncate" title={item.reason}>
                      {item.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                    </td>

                    <td className="p-3">{getStatusBadge(item.status)}</td>

                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedRequest(item);
                            setDetailModalOpen(true);
                          }}
                          className="admin-action flex items-center gap-1 text-xs"
                          title="View Request Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </button>

                        <button
                          onClick={() => {
                            setUpdateRequest(item);
                            setNewStatus(item.status);
                            setRejectionReason(item.rejectionReason || "");
                            setAdminNotes(item.adminNotes || "");
                          }}
                          className="admin-action text-xs"
                        >
                          Update Status
                        </button>

                        {item.status !== "completed" && (
                          <button
                            onClick={() => {
                              setExecuteRequest(item);
                              setAdminNotes("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--oxblood)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Data
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    No account deletion requests found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages} ({total} total requests)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="admin-action disabled:opacity-45"
                disabled={page <= 1 || loading}
                onClick={() => setPage((val) => Math.max(1, val - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="admin-action disabled:opacity-45"
                disabled={page >= pages || loading}
                onClick={() => setPage((val) => Math.min(pages, val + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </AdminPanel>

      {/* Details Dialog */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Account Deletion Request Details</DialogTitle>
            <DialogDescription>
              Reference ID: <span className="font-mono font-bold text-[var(--oxblood)]">{selectedRequest?.id}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--ivory)] p-3">
                  <div className="text-muted-foreground">Name</div>
                  <div className="font-semibold text-sm mt-0.5">{selectedRequest.name}</div>
                </div>
                <div className="rounded-xl bg-[var(--ivory)] p-3">
                  <div className="text-muted-foreground">Registered Email</div>
                  <div className="font-semibold text-sm mt-0.5">{selectedRequest.email}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--ivory)] p-3">
                <div className="text-muted-foreground">Reason for Deletion</div>
                <div className="mt-1 font-medium text-sm leading-relaxed">
                  {selectedRequest.reason || "No detailed reason provided."}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-3">
                <div className="font-semibold text-xs mb-1">Matched Account Record</div>
                {selectedRequest.user ? (
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Account Role:</dt><dd className="font-semibold capitalize">{selectedRequest.user.role}</dd></div>
                    <div><dt className="text-muted-foreground">Account Status:</dt><dd className="font-semibold">{selectedRequest.user.status || "active"}</dd></div>
                    <div><dt className="text-muted-foreground">User ID:</dt><dd className="font-mono text-[10px]">{selectedRequest.user.id}</dd></div>
                    <div><dt className="text-muted-foreground">Joined Date:</dt><dd className="font-semibold">{selectedRequest.user.createdAt ? new Date(selectedRequest.user.createdAt).toLocaleDateString("en-PK") : "—"}</dd></div>
                  </dl>
                ) : (
                  <p className="text-muted-foreground italic">No registered user account found matching this email.</p>
                )}
              </div>

              {selectedRequest.rejectionReason && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200">
                  <div className="font-semibold text-red-800">Rejection Reason</div>
                  <div className="mt-1 text-red-700">{selectedRequest.rejectionReason}</div>
                </div>
              )}

              {selectedRequest.adminNotes && (
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
                  <div className="font-semibold text-amber-800">Admin Notes</div>
                  <div className="mt-1 text-amber-900">{selectedRequest.adminNotes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setDetailModalOpen(false)} className="btn-ghost">
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!updateRequest} onOpenChange={(open) => !open && setUpdateRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Request Status</DialogTitle>
            <DialogDescription>
              Change status for <strong>{updateRequest?.name}</strong> ({updateRequest?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="art-field w-full bg-[var(--porcelain)]"
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {newStatus === "rejected" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why deletion was rejected..."
                  className="art-field w-full"
                  rows={2}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Admin Notes <span className="text-muted-foreground font-normal">(Internal)</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notes for internal audit trail..."
                className="art-field w-full"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setUpdateRequest(null)} className="btn-ghost" disabled={isUpdatingStatus}>
              Cancel
            </button>
            <button onClick={handleUpdateStatus} className="btn-primary" disabled={isUpdatingStatus}>
              {isUpdatingStatus ? "Saving..." : "Save Status"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Permanent Deletion Dialog */}
      <Dialog open={!!executeRequest} onOpenChange={(open) => !open && setExecuteRequest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Confirm Permanent Account Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to execute permanent account deletion for <strong>{executeRequest?.name}</strong> ({executeRequest?.email})?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-red-900 font-medium">
              Warning: This action will permanently erase user login credentials, profile details, uploaded store items, wishlists, and notifications.
            </div>

            <p>
              In accordance with Google Play rules and financial tax regulations, financial invoice history will be anonymized and retained for legal compliance.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Admin Execution Notes <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Reason or audit log notes for executing account deletion..."
                className="art-field w-full"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setExecuteRequest(null)} className="btn-ghost" disabled={isExecuting}>
              Cancel
            </button>
            <button
              onClick={handleExecuteDeletion}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oxblood)] px-4 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50"
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing Deletion...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Permanently Delete User & Data
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
