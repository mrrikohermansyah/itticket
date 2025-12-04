import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../utils/firebase-config.js";

const __createLogUI = () => {
  try {
    if (document.getElementById("debugLogPanel")) return;
    const panel = document.createElement("div");
    panel.id = "debugLogPanel";
    panel.style.position = "fixed";
    panel.style.bottom = "12px";
    panel.style.right = "12px";
    panel.style.width = "min(420px, 92vw)";
    panel.style.maxHeight = "40vh";
    panel.style.overflow = "auto";
    panel.style.background = "var(--surface)";
    panel.style.border = "1px solid var(--border)";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)";
    panel.style.padding = "8px";
    panel.style.fontSize = ".85rem";
    panel.style.zIndex = "9999";
    panel.style.display = "none";
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "6px";
    const title = document.createElement("div");
    title.textContent = "Debug Logs";
    const toggle = document.createElement("button");
    toggle.textContent = "Close";
    toggle.className = "btn-secondary";
    toggle.onclick = () => {
      panel.style.display = "none";
    };
    const list = document.createElement("div");
    list.id = "debugLogList";
    list.style.display = "grid";
    list.style.gap = "4px";
    header.appendChild(title);
    header.appendChild(toggle);
    panel.appendChild(header);
    panel.appendChild(list);
    document.body.appendChild(panel);
  } catch (_) {}
};
__createLogUI();
window.__dashLogs = [];
window.__dashLog = (type, message, detail) => {
  try {
    const ts = new Date().toISOString();
    const entry = { ts, type, message, detail };
    window.__dashLogs.unshift(entry);
    if (window.__dashLogs.length > 200) window.__dashLogs.pop();
    const list = document.getElementById("debugLogList");
    if (list) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "120px 80px 1fr";
      row.style.alignItems = "start";
      const colTs = document.createElement("div");
      colTs.textContent = ts;
      const colType = document.createElement("div");
      colType.textContent = type;
      const colMsg = document.createElement("div");
      const msgText = typeof message === "string" ? message : String(message);
      const detText = detail
        ? typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
        : "";
      colMsg.textContent = detText ? msgText + " | " + detText : msgText;
      row.appendChild(colTs);
      row.appendChild(colType);
      row.appendChild(colMsg);
      list.prepend(row);
    }
    const prefix = type === "error" ? "❌" : type === "warn" ? "⚠️" : "ℹ️";
    console.log(prefix, ts, message, detail || "");
  } catch (_) {}
};

import firebaseAuthService from "../services/firebase-auth-service.js";

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.authService = firebaseAuthService;
    this.db = db;
    this.unsubscribeTickets = null;
    this.displayCount = 5;
    this.pageSize = 20;
    this.lastVisible = null;
    this.cacheTTL = 60000;
    this.deferRealtimeUntil = 0;
    this.userFilterStatus = "All";
    this.userFilterStart = null;
    this.userFilterEnd = null;
    this.init();
  }

  async init() {
    try {
      let user = await this.authService.getCurrentUser();
      if (!user && window.auth && window.auth.currentUser) {
        user = window.auth.currentUser;
      }
      if (!user) {
        const mainElImmediate = document.getElementById("dashboardMain");
        if (mainElImmediate) {
          mainElImmediate.style.visibility = "visible";
        }
        this.showError("Session expired. Please sign in again.");
        return;
      }

      let profile = null;
      try {
        profile = await this.authService.getUserProfile(user.uid);
      } catch (_) {}

      if (profile) {
        this.currentUser = {
          id: user.uid,
          email: user.email || profile.email || "",
          ...profile,
        };
      } else {
        this.currentUser = {
          id: user.uid,
          email: user.email || "",
          full_name: (user.email || "").split("@")[0] || "User",
          role: "user",
          department: "",
          location: "",
        };
      }

      window.__dashLog("info", "User loaded", {
        id: this.currentUser.id,
        email: this.currentUser.email,
      });
      try {
        console.info("Dashboard currentUser", this.currentUser);
      } catch (_) {}

      this.loadUserInfo();
      this.initializeEventListeners();

      const mainElImmediate = document.getElementById("dashboardMain");
      if (mainElImmediate) {
        mainElImmediate.style.visibility = "visible";
      }

      await this.setupRealtimeTickets();
      window.__dashLog("info", "Realtime setup requested");
    } catch (error) {
      window.__dashLog(
        "error",
        "Dashboard init error",
        error?.message || String(error)
      );
      this.showError("System initializing...");
    }
  }

  async setupRealtimeTickets() {
    try {
      const mainEl = document.getElementById("dashboardMain");
      if (mainEl) mainEl.style.visibility = "visible";

      if (this.unsubscribeTickets) {
        try {
          this.unsubscribeTickets();
        } catch (_) {}
      }

      const arrUid = [];
      const arrEmail = [];
      const subs = [];
      if (this.currentUser?.id) {
        const qUid = query(
          collection(this.db, "tickets"),
          where("user_id", "==", this.currentUser.id),
          orderBy("created_at", "desc"),
          limit(this.pageSize)
        );
        try {
          console.info("Realtime query set (uid)", {
            uid: this.currentUser.id,
          });
        } catch (_) {}
        const u1 = onSnapshot(
          qUid,
          (snapshot) => {
            try {
              console.info("Realtime snapshot (uid)", { size: snapshot.size });
            } catch (_) {}
            arrUid.length = 0;
            snapshot.forEach((ds) => {
              try {
                arrUid.push(this.normalizeTicketData(ds.id, ds.data()));
              } catch (_) {}
            });
            const map = new Map();
            for (const t of [...arrUid, ...arrEmail]) map.set(t.id, t);
            const merged = Array.from(map.values());
            merged.sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
            this.tickets = merged;
            this.renderTickets();
            this.updateStats();
          },
          (error) => {
            window.__dashLog(
              "error",
              "Realtime listener error (uid)",
              error?.message || String(error)
            );
            try {
              const qUidFallback = query(
                collection(this.db, "tickets"),
                where("user_id", "==", this.currentUser.id)
              );
              console.warn("Using fallback realtime (uid) without orderBy");
              const u1fb = onSnapshot(
                qUidFallback,
                (snap) => {
                  arrUid.length = 0;
                  snap.forEach((ds) => {
                    try {
                      arrUid.push(this.normalizeTicketData(ds.id, ds.data()));
                    } catch (_) {}
                  });
                  const map = new Map();
                  for (const t of [...arrUid, ...arrEmail]) map.set(t.id, t);
                  const merged = Array.from(map.values());
                  merged.sort(
                    (a, b) => new Date(b.created_at) - new Date(a.created_at)
                  );
                  this.tickets = merged;
                  this.renderTickets();
                  this.updateStats();
                },
                () => {}
              );
              subs.push(u1fb);
            } catch (_) {
              this.showFirestoreError();
            }
          }
        );
        subs.push(u1);
      }
      if (this.currentUser?.email) {
        const qEmail = query(
          collection(this.db, "tickets"),
          where("user_email", "==", this.currentUser.email),
          orderBy("created_at", "desc"),
          limit(this.pageSize)
        );
        try {
          console.info("Realtime query set (email)", {
            email: this.currentUser.email,
          });
        } catch (_) {}
        const u2 = onSnapshot(
          qEmail,
          (snapshot) => {
            try {
              console.info("Realtime snapshot (email)", {
                size: snapshot.size,
              });
            } catch (_) {}
            arrEmail.length = 0;
            snapshot.forEach((ds) => {
              try {
                arrEmail.push(this.normalizeTicketData(ds.id, ds.data()));
              } catch (_) {}
            });
            const map = new Map();
            for (const t of [...arrUid, ...arrEmail]) map.set(t.id, t);
            const merged = Array.from(map.values());
            merged.sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
            this.tickets = merged;
            this.renderTickets();
            this.updateStats();
          },
          (error) => {
            window.__dashLog(
              "error",
              "Realtime listener error (email)",
              error?.message || String(error)
            );
            try {
              const qEmailFallback = query(
                collection(this.db, "tickets"),
                where("user_email", "==", this.currentUser.email)
              );
              console.warn("Using fallback realtime (email) without orderBy");
              const u2fb = onSnapshot(
                qEmailFallback,
                (snap) => {
                  arrEmail.length = 0;
                  snap.forEach((ds) => {
                    try {
                      arrEmail.push(this.normalizeTicketData(ds.id, ds.data()));
                    } catch (_) {}
                  });
                  const map = new Map();
                  for (const t of [...arrUid, ...arrEmail]) map.set(t.id, t);
                  const merged = Array.from(map.values());
                  merged.sort(
                    (a, b) => new Date(b.created_at) - new Date(a.created_at)
                  );
                  this.tickets = merged;
                  this.renderTickets();
                  this.updateStats();
                },
                () => {}
              );
              subs.push(u2fb);
            } catch (_) {
              this.showFirestoreError();
            }
          }
        );
        subs.push(u2);
      }

      this.unsubscribeTickets = () => {
        subs.forEach((fn) => {
          try {
            fn();
          } catch (_) {}
        });
      };
    } catch (error) {
      window.__dashLog(
        "error",
        "SetupRealtime failed",
        error?.message || String(error)
      );
      this.showFirestoreError();
    }
  }

  async loadMoreTickets() {
    try {
      if (!this.currentUser || !this.currentUser.id) return;
      const appended = [];
      const baseUid = [
        collection(this.db, "tickets"),
        where("user_id", "==", this.currentUser.id),
        orderBy("created_at", "desc"),
      ];
      const partsUid = this.lastVisible
        ? [...baseUid, startAfter(this.lastVisible)]
        : baseUid;
      const qUid = query(...partsUid, limit(this.pageSize));
      const snapUid = await getDocs(qUid);
      snapUid.forEach((docSnap) => {
        appended.push(this.normalizeTicketData(docSnap.id, docSnap.data()));
      });
      if (this.currentUser?.email) {
        const baseEmail = [
          collection(this.db, "tickets"),
          where("user_email", "==", this.currentUser.email),
          orderBy("created_at", "desc"),
        ];
        const partsEmail = this.lastVisible
          ? [...baseEmail, startAfter(this.lastVisible)]
          : baseEmail;
        const qEmail = query(...partsEmail, limit(this.pageSize));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((docSnap) => {
          appended.push(this.normalizeTicketData(docSnap.id, docSnap.data()));
        });
      }
      appended.forEach((t) => {
        if (!this.tickets.find((x) => x.id === t.id)) {
          this.tickets.push(t);
        }
      });
      this.displayCount = Math.max(
        this.displayCount,
        (this.displayCount || 5) + appended.length
      );
      this.tickets.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      this.renderTickets();
      window.__dashLog("info", "Loaded more tickets", {
        appended: appended.length,
        total: this.tickets.length,
      });
    } catch (e) {
      window.__dashLog(
        "error",
        "Error loading more tickets",
        e?.message || String(e)
      );
    }
  }

  showFirestoreError() {
    const mainEl = document.getElementById("dashboardMain");
    if (mainEl) mainEl.style.visibility = "visible";
    const ticketsList = document.getElementById("ticketsList");
    if (ticketsList) {
      ticketsList.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Database Access Limited</h3>
          <p>You can still submit new tickets, but viewing existing tickets is temporarily unavailable.</p>
          <button class="btn-retry" id="retryTickets">Retry Connection</button>
        </div>`;
      const btn = document.getElementById("retryTickets");
      if (btn) btn.addEventListener("click", () => this.setupRealtimeTickets());
    }
    window.__dashLog("warn", "User-visible Firestore error state shown");
  }

  normalizeTicketData(id, data) {
    const created =
      data.created_at && typeof data.created_at.toDate === "function"
        ? data.created_at.toDate()
        : data.created_at
        ? new Date(data.created_at)
        : new Date();
    const updated =
      data.last_updated && typeof data.last_updated.toDate === "function"
        ? data.last_updated.toDate()
        : data.last_updated
        ? new Date(data.last_updated)
        : created;
    let actionBy = data.action_by || "";
    let adminId = "";
    const m = actionBy.match(/Admin\s*\(([^)]+)\)/);
    if (m) {
      adminId = m[1];
      actionBy = "Admin";
    }
    const obj = {
      id,
      code: data.code || "",
      subject: data.subject || "",
      inventory: data.inventory || "",
      device: data.device || "Others",
      priority: data.priority || "Medium",
      location: data.location || "",
      user_id: data.user_id || this.currentUser?.id || "",
      user_name: data.user_name || "",
      user_email: data.user_email || "",
      user_department: data.user_department || "",
      user_phone: data.user_phone || "",
      status: data.status || data.qa || "Open",
      qa: data.qa || "Open",
      note: data.note || "",
      updates: Array.isArray(data.updates) ? data.updates : [],
      action_by:
        actionBy ||
        (adminId ? "Admin" : data.assigned_to ? "Admin" : "Unassigned"),
      action_by_email: data.action_by_email || "",
      admin_id: adminId || data.assigned_to || "",
      created_at: created.toISOString(),
      last_updated: updated.toISOString(),
      deleted: data.deleted || false,
      deleted_at:
        data.deleted_at && typeof data.deleted_at.toDate === "function"
          ? data.deleted_at.toDate().toISOString()
          : data.deleted_at || null,
      deleted_by: data.deleted_by || "",
      deleted_by_name: data.deleted_by_name || "",
      delete_reason: data.delete_reason || "",
    };
    return obj;
  }

  getTicketStatusDisplay(ticket) {
    const status = (ticket.status || "").toLowerCase().trim();
    const qa = (ticket.qa || "").toLowerCase().trim();
    if (
      ["resolved", "closed", "completed", "finished", "finish"].includes(
        status
      ) ||
      ["finish", "finished"].includes(qa)
    )
      return "Resolved";
    if (status === "in progress") return "In Progress";
    if (status === "pending") return "Pending";
    return "Open";
  }

  isTicketOpen(ticket) {
    const d = this.getTicketStatusDisplay(ticket);
    return d === "Open" || d === "In Progress" || d === "Pending";
  }

  canDeleteTicket(ticket) {
    if (!this.currentUser || ticket.user_id !== this.currentUser.id)
      return false;
    const statusDisplay = this.getTicketStatusDisplay(ticket);
    return !ticket.deleted && statusDisplay === "Open";
  }

  renderTickets() {
    const ticketsList = document.getElementById("ticketsList");
    const tableContainer = document.getElementById("userTicketsTableContainer");
    const tableBody = document.getElementById("userTicketsTableBody");
    const tableFooter = document.getElementById("userTicketsTableFooter");
    if (!ticketsList && !tableBody) return;

    let filtered = this.tickets.filter((t) => !t.deleted);
    if (this.userFilterStatus && this.userFilterStatus !== "All") {
      filtered = filtered.filter(
        (t) => this.getTicketStatusDisplay(t) === this.userFilterStatus
      );
    }
    if (this.userFilterStart || this.userFilterEnd) {
      filtered = filtered.filter((t) => {
        const d = new Date(t.created_at);
        const sOk = this.userFilterStart
          ? d >= new Date(this.userFilterStart)
          : true;
        const eOk = this.userFilterEnd
          ? d <= new Date(this.userFilterEnd + "T23:59:59")
          : true;
        return sOk && eOk;
      });
    }
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = filtered.length;
    const count = Math.min(this.displayCount, total);
    const ticketsToShow = filtered.slice(0, count);

    if (ticketsList) {
      const html = ticketsToShow
        .map((ticket) => {
          const statusDisplay = this.getTicketStatusDisplay(ticket);
          const canDelete = this.canDeleteTicket(ticket);
          const assigned =
            ticket.action_by && ticket.action_by !== "Unassigned"
              ? `<div class="ticket-assigned"><small><strong>Assigned to:</strong> ${
                  ticket.action_by
                }${
                  ticket.action_by_email ? ` (${ticket.action_by_email})` : ""
                }</small></div>`
              : `<div class="ticket-unassigned"><small class="unassigned-text">Unassigned</small></div>`;
          const latestUpdate =
            ticket.updates && ticket.updates.length > 0
              ? `<div class="ticket-updates"><small><strong>Latest Update:</strong> ${
                  ticket.updates[ticket.updates.length - 1].notes || ""
                }</small></div>`
              : "";
          return `
          <div class="ticket-item ${
            ticket.id.startsWith("temp-") ? "ticket-temporary" : ""
          } ${canDelete ? "deletable" : ""}">
            <div class="ticket-meta">
              <div class="ticket-priority priority-${(
                ticket.priority || "medium"
              ).toLowerCase()}">${ticket.priority || "Medium"}</div>
              <h4 class="ticket-subject">${ticket.subject || "No subject"}</h4>
              <span class="ticket-device">${ticket.device || "No device"}</span>
              <span class="ticket-location">${
                ticket.location || "No location"
              }</span>
              <span class="ticket-status status-${statusDisplay
                .toLowerCase()
                .replace(" ", "-")}">${statusDisplay}</span>
              <span class="ticket-created">${
                ticket.created_at
                  ? new Date(ticket.created_at).toLocaleDateString()
                  : "Unknown date"
              }</span>
            </div>
            ${assigned}
            ${
              ticket.note
                ? `<div class="ticket-notes"><small>${ticket.note}</small></div>`
                : ""
            }
            ${latestUpdate}
            <div class="ticket-actions">
              <button class="btn-delete-ticket" data-ticket-id="${
                ticket.id
              }" data-ticket-code="${ticket.code}" ${
            canDelete ? "" : "disabled"
          }>
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        `;
        })
        .join("");
      const hasMore = total > count || !!this.lastVisible;
      const controls = `
        <div class="load-more-container" style="text-align:center; margin-top: 0.75rem;">
          ${
            hasMore
              ? `<button id="loadMoreTickets" class="btn-secondary"><span class="btn-text">Load More</span></button>`
              : ""
          }
          ${
            total > count
              ? `<button id="showAllTickets" class="btn-secondary"><span class="btn-text">Show All</span></button>`
              : ""
          }
          ${
            count > 5
              ? `<button id="closeTicketsView" class="btn-secondary"><span class="btn-text">Close</span></button>`
              : ""
          }
          <small class="text-muted" style="display:block; margin-top:0.25rem;">Showing ${
            ticketsToShow.length
          } of ${total}</small>
        </div>
      `;
      ticketsList.innerHTML = html + controls;
    }

    if (tableContainer && tableBody) {
      tableBody.innerHTML = ticketsToShow
        .map((ticket) => {
          const statusDisplay = this.getTicketStatusDisplay(ticket);
          const canDelete = this.canDeleteTicket(ticket);
          const createdDate = ticket.created_at
            ? new Date(ticket.created_at).toLocaleString(undefined, {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "N/A";
          const priorityLower = (ticket.priority || "Medium").toLowerCase();
          const statusClass = statusDisplay.toLowerCase().replace(/\s+/g, "-");
          return `
          <tr>
            <td data-label="Code" style="padding:8px;"><strong>${
              ticket.code || "N/A"
            }</strong></td>
            <td data-label="Subject" style="padding:8px;">${
              ticket.subject || "No Subject"
            }
              <div class="meta-inline">
                <span class="meta-chip">${ticket.location || "N/A"}</span>
                <span class="meta-chip priority-${priorityLower}">${
            ticket.priority || "Medium"
          }</span>
                <span class="meta-chip status-${statusClass}">${statusDisplay}</span>
                <span class="meta-chip">${createdDate}</span>
              </div>
            </td>
            <td data-label="Location" style="padding:8px;">${
              ticket.location || "N/A"
            }</td>
            <td data-label="Priority" style="padding:8px;"><span class="meta-chip priority-${priorityLower}">${
            ticket.priority || "Medium"
          }</span></td>
            <td data-label="Action" style="padding:8px;">
              <button class="btn-delete-ticket" data-ticket-id="${
                ticket.id
              }" data-ticket-code="${ticket.code}" ${
            canDelete ? "" : "disabled"
          }>
                <i class="fas fa-trash"></i> Delete
              </button>
            </td>
          </tr>
        `;
        })
        .join("");
      tableContainer.style.display = "block";
      if (ticketsList) ticketsList.style.display = "none";
      const hasMore = total > count || !!this.lastVisible;
      const showClose = count > 5;
      const footerHtml = `
        <div class="load-more-container animate-in" style="text-align:center;">
          ${
            hasMore
              ? `<button id="loadMoreTicketsTable" class="btn-secondary"><span class="btn-text">Load More</span></button>`
              : ""
          }
          ${
            total > count
              ? `<button id="showAllTicketsTable" class="btn-secondary"><span class="btn-text">Show All</span></button>`
              : ""
          }
          ${
            showClose
              ? `<button id="closeTicketsViewTable" class="btn-secondary"><span class="btn-text">Close</span></button>`
              : ""
          }
          <small class="text-muted" style="display:block; margin-top:0.25rem;">Showing ${
            ticketsToShow.length
          } of ${total}</small>
        </div>
      `;
      if (tableFooter) tableFooter.innerHTML = footerHtml;
    }

    this.attachDeleteEventListeners();

    const loadMoreBtn = document.getElementById("loadMoreTickets");
    if (loadMoreBtn)
      loadMoreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.loadMoreTickets();
      });
    const showAllBtn = document.getElementById("showAllTickets");
    if (showAllBtn)
      showAllBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.displayCount = filtered.length;
        this.renderTickets();
      });
    const closeBtn = document.getElementById("closeTicketsView");
    if (closeBtn)
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.displayCount = 5;
        this.renderTickets();
      });

    const loadMoreBtnT = document.getElementById("loadMoreTicketsTable");
    if (loadMoreBtnT)
      loadMoreBtnT.addEventListener("click", (e) => {
        e.preventDefault();
        this.loadMoreTickets();
      });
    const showAllBtnT = document.getElementById("showAllTicketsTable");
    if (showAllBtnT)
      showAllBtnT.addEventListener("click", (e) => {
        e.preventDefault();
        this.displayCount = filtered.length;
        this.renderTickets();
      });
    const closeBtnT = document.getElementById("closeTicketsViewTable");
    if (closeBtnT)
      closeBtnT.addEventListener("click", (e) => {
        e.preventDefault();
        this.displayCount = 5;
        this.renderTickets();
      });
  }

  attachDeleteEventListeners() {
    const deleteButtons = document.querySelectorAll(".btn-delete-ticket");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const ticketId = button.getAttribute("data-ticket-id");
        const ticketCode = button.getAttribute("data-ticket-code");
        this.handleDeleteTicket(ticketId, ticketCode);
      });
    });
  }

  async handleDeleteTicket(ticketId, ticketCode) {
    const ticketObj = this.tickets.find((t) => t.id === ticketId) || null;
    const statusDisplay = ticketObj
      ? this.getTicketStatusDisplay(ticketObj)
      : "";
    const assignedDisplay = ticketObj
      ? ticketObj.action_by || "Unassigned"
      : "Unassigned";
    const result = await Swal.fire({
      title: "Delete Ticket?",
      html: `
        <div class="delete-confirmation">
          <div class="delete-summary">
            <div class="delete-summary-row"><span class="delete-field">Ticket</span><span class="delete-value">${ticketCode}</span></div>
            <div class="delete-summary-row"><span class="delete-field">Status</span><span class="delete-value">${statusDisplay}</span></div>
            <div class="delete-summary-row"><span class="delete-field">Assigned</span><span class="delete-value">${assignedDisplay}</span></div>
          </div>
          <p class="warning-text">This action cannot be undone!</p>
          <div class="form-group">
            <label for="deleteReason"><strong>Reason for deletion (optional):</strong></label>
            <textarea id="deleteReason" class="swal2-textarea" placeholder="Reason"></textarea>
          </div>
        </div>
      `,
      icon: "warning",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
      focusCancel: true,
      showCancelButton: true,
    });
    if (result.isConfirmed) {
      const deleteReason =
        document.getElementById("deleteReason")?.value.trim() ||
        "No reason provided";
      await Swal.fire({
        title: "Deleting Ticket...",
        text: "Please wait while we delete your ticket",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      try {
        const ticketRef = doc(this.db, "tickets", ticketId);
        await updateDoc(ticketRef, {
          deleted: true,
          deleted_by: this.currentUser.id,
          deleted_by_name: this.currentUser.full_name || "User",
          delete_reason: deleteReason,
          last_updated: serverTimestamp(),
        });
        await Swal.fire({
          title: "Deleted!",
          html: `
            <div class="delete-success">
              <i class="fas fa-check-circle text-success"></i>
              <p>Ticket ${ticketCode} has been deleted.</p>
            </div>
          `,
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#10b981",
          timer: 3000,
          timerProgressBar: true,
        });
      } catch (error) {
        await Swal.fire({
          title: "Error!",
          text: error.message || "Failed to delete ticket. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#ef4444",
        });
      }
    }
  }

  updateStats() {
    const activeTickets = this.tickets.filter((ticket) => !ticket.deleted);
    const openTickets = activeTickets.filter((ticket) =>
      this.isTicketOpen(ticket)
    );
    const resolvedTickets = activeTickets.filter(
      (ticket) => !this.isTicketOpen(ticket)
    );
    const openEl = document.getElementById("openTickets");
    const resolvedEl = document.getElementById("resolvedTickets");
    if (openEl) openEl.textContent = openTickets.length;
    if (resolvedEl) resolvedEl.textContent = resolvedTickets.length;
  }

  cleanup() {
    if (this.unsubscribeTickets) {
      try {
        this.unsubscribeTickets();
      } catch (_) {}
    }
  }

  async handleLogout() {
    const result = await Swal.fire({
      title: "Logout Confirmation",
      text: "Are you sure you want to logout?",
      icon: "question",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Cancel",
      showCancelButton: true,
    });
    if (result.isConfirmed) {
      this.cleanup();
      await this.authService.logout();
      window.location.href = "../../index.html";
    }
  }

  loadUserInfo() {
    const userNameElement = document.getElementById("userName");
    const userEmailElement = document.getElementById("userEmail");
    const welcomeUserNameElement = document.getElementById("welcomeUserName");
    if (this.currentUser) {
      if (userNameElement)
        userNameElement.textContent = this.currentUser.full_name || "User";
      if (userEmailElement)
        userEmailElement.textContent = this.currentUser.email || "";
      if (welcomeUserNameElement)
        welcomeUserNameElement.textContent =
          this.currentUser.full_name || "User";
      const uidEl = document.getElementById("user_id");
      const unameEl = document.getElementById("user_name");
      const uemailEl = document.getElementById("user_email");
      const udeptEl = document.getElementById("user_department");
      const createdEl = document.getElementById("created_at");
      if (uidEl) uidEl.value = this.currentUser.id;
      if (unameEl) unameEl.value = this.currentUser.full_name || "";
      if (uemailEl) uemailEl.value = this.currentUser.email || "";
      if (udeptEl) udeptEl.value = this.currentUser.department || "";
      if (createdEl) createdEl.value = new Date().toISOString();
    }
  }

  initializeEventListeners() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn)
      logoutBtn.addEventListener("click", () => this.handleLogout());
    const ticketForm = document.getElementById("ticketForm");
    if (ticketForm) {
      ticketForm.addEventListener("submit", (e) => this.handleTicketSubmit(e));
      ticketForm.addEventListener("reset", () => this.hideMessages());
    }
    const statusFilter = document.getElementById("userStatusFilter");
    const startFilter = document.getElementById("userDateStartFilter");
    const endFilter = document.getElementById("userDateEndFilter");
    const clearFilter = document.getElementById("userFilterClear");
    if (statusFilter)
      statusFilter.addEventListener("change", (e) => {
        this.userFilterStatus = e.target.value || "All";
        this.renderTickets();
      });
    if (startFilter)
      startFilter.addEventListener("change", (e) => {
        this.userFilterStart = e.target.value || null;
        this.renderTickets();
      });
    if (endFilter)
      endFilter.addEventListener("change", (e) => {
        this.userFilterEnd = e.target.value || null;
        this.renderTickets();
      });
    if (clearFilter)
      clearFilter.addEventListener("click", (e) => {
        e.preventDefault();
        const sf = statusFilter;
        const st = startFilter;
        const ef = endFilter;
        if (sf) sf.value = "All";
        if (st) st.value = "";
        if (ef) ef.value = "";
        this.userFilterStatus = "All";
        this.userFilterStart = null;
        this.userFilterEnd = null;
        this.renderTickets();
      });
  }

  showError(message) {
    const el = document.getElementById("ticketErrorMessage");
    if (el) {
      el.textContent = message;
      el.style.display = "block";
      setTimeout(() => {
        el.style.display = "none";
      }, 5000);
    }
  }

  hideMessages() {
    const e = document.getElementById("ticketErrorMessage");
    const s = document.getElementById("ticketSuccessMessage");
    if (e) e.style.display = "none";
    if (s) s.style.display = "none";
  }

  getFormData(form) {
    const data = {};
    for (const [key, value] of new FormData(form)) {
      data[key] = value;
    }
    return data;
  }

  validateTicketForm(formData) {
    const required = [
      "inventory",
      "device",
      "location",
      "priority",
      "subject",
      "message",
    ];
    for (const k of required) {
      if (!formData[k] || String(formData[k]).trim() === "") {
        return {
          isValid: false,
          message: "Please fill in all required fields",
        };
      }
    }
    return { isValid: true };
  }

  async handleTicketSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitTicketBtn");
    if (!submitBtn) return;
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");
    if (btnText) btnText.style.display = "none";
    if (btnLoading) btnLoading.style.display = "flex";
    submitBtn.disabled = true;
    this.hideMessages();
    try {
      const form = document.getElementById("ticketForm");
      const formData = this.getFormData(form);
      const validation = this.validateTicketForm(formData);
      if (!validation.isValid) throw new Error(validation.message);
      if (!this.currentUser || !this.currentUser.id)
        throw new Error("Not authenticated. Please sign in again.");
      const payload = {
        subject: formData.subject,
        message: formData.message,
        location: formData.location,
        device: formData.device,
        inventory: formData.inventory || "",
        user_id: this.currentUser.id,
        user_name: this.currentUser.full_name || "",
        user_email: this.currentUser.email || "",
        user_department: this.currentUser.department || "",
        user_phone: this.currentUser.phone || "",
        status: "Open",
        qa: "Open",
        updates: [
          {
            status: "Open",
            notes: "Ticket created by user",
            timestamp: new Date().toISOString(),
            updatedBy: this.currentUser.full_name || "User",
          },
        ],
        action_by: "",
        note: "",
      };
      const addPromise = addDoc(collection(this.db, "tickets"), payload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Ticket creation timeout (20s)")),
          20000
        )
      );
      const ticketRef = await Promise.race([addPromise, timeoutPromise]);
      const ticketCode = window.generateTicketId
        ? window.generateTicketId(
            this.currentUser.department || "IT",
            formData.device || "Others",
            formData.location || "",
            ticketRef.id,
            formData.subject || ""
          )
        : "T-" + ticketRef.id.slice(-3).toUpperCase();
      try {
        await updateDoc(ticketRef, { code: ticketCode });
      } catch (e2) {
        window.__dashLog(
          "warn",
          "Failed to update code",
          e2?.message || String(e2)
        );
      }
      await Swal.fire({
        title: "🎉 Ticket Created Successfully!",
        html: `
          <div class="ticket-success-alert">
            <div class="success-header"><i class="fas fa-check-circle"></i><h3>Your ticket has been submitted</h3></div>
            <div class="ticket-details">
              <div class="detail-row"><span class="detail-label">Ticket Code:</span><span class="detail-value ticket-code">${ticketCode}</span></div>
              <div class="detail-row"><span class="detail-label">Subject:</span><span class="detail-value">${
                formData.subject
              }</span></div>
              <div class="detail-row"><span class="detail-label">Priority:</span><span class="detail-value priority-${
                formData.priority
              }">${
          { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" }[
            formData.priority
          ] || formData.priority
        }</span></div>
              <div class="detail-row"><span class="detail-label">Device:</span><span class="detail-value">${
                formData.device
              }</span></div>
              <div class="detail-row"><span class="detail-label">Location:</span><span class="detail-value">${
                formData.location
              }</span></div>
            </div>
            <div class="success-message"><p>✅ Your ticket has been logged and our team will review it shortly.</p><p>📧 You will receive updates via email.</p></div>
          </div>
        `,
        icon: "success",
        iconColor: "#10b981",
        confirmButtonText: "Got It!",
        confirmButtonColor: "#ef070a",
        background: "#f8fafc",
        showClass: {
          popup: "animate__animated animate__fadeInDown animate__faster",
        },
        hideClass: {
          popup: "animate__animated animate__fadeOutUp animate__faster",
        },
        timer: 8000,
        timerProgressBar: true,
        willClose: () => {},
      });
      if (form) form.reset();
    } catch (error) {
      const isPerm =
        error &&
        (error.code === "permission-denied" ||
          /insufficient permissions/i.test(error?.message));
      const msg = isPerm
        ? "Permission denied. Please sign in again atau hubungi IT."
        : error.message || "Failed to create ticket";
      await Swal.fire({
        title: "Ticket Failed",
        text: msg,
        icon: "error",
        confirmButtonColor: "#ef070a",
      });
    } finally {
      const submitBtn = document.getElementById("submitTicketBtn");
      if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector(".btn-text");
        const btnLoading = submitBtn.querySelector(".btn-loading");
        if (btnText) btnText.style.display = "block";
        if (btnLoading) btnLoading.style.display = "none";
      }
    }
  }
}

try {
  window.Dashboard = Dashboard;
} catch (_) {}
try {
  document.addEventListener("DOMContentLoaded", () => {
    new Dashboard();
    try {
      window.__dashModuleLoaded = true;
    } catch (_) {}
  });
} catch (_) {}

const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .status-open { color: #ef070a; }
  .status-in-progress { color: #f59e0b; }
  .status-pending { color: #8b5cf6; }
  .status-resolved { color: #10b981; }
  .status-closed { color: #6b7280; }
  .status-finish { color: #10b981; }
  .status-rejected { color: #ef4444; }
  .ticket-temporary { opacity: 0.7; background: var(--gray-50); }
  .ticket-saving { color: #6c757d; font-style: italic; }
  .ticket-assigned { background: var(--gray-100); padding: 8px 12px; border-radius: 6px; margin: 8px 0; border-left: 3px solid var(--primary); }
  .ticket-unassigned { background: var(--gray-100); padding: 8px 12px; border-radius: 6px; margin: 8px 0; border-left: 3px solid var(--gray-300); }
  .unassigned-text { color: #6b7280; font-style: italic; }
  .ticket-notes, .ticket-updates { background: var(--gray-100); padding: 8px 12px; border-radius: 6px; margin: 6px 0; border-left: 3px solid var(--yellow-500); }
  .ticket-actions { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; }
  .btn-delete-ticket { background: transparent; color: var(--red-500); border: 1px solid var(--red-500); padding: 6px 12px; border-radius: 6px; font-size: 0.875rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 6px; }
  .btn-delete-ticket:hover { background: var(--red-500); color: var(--white); border-color: var(--red-500); }
  .btn-delete-ticket:disabled { opacity: 0.5; cursor: not-allowed; }
  .ticket-item.deletable { border-left: 3px solid var(--red-500); background: transparent; }
  .empty-state { text-align: center; padding: 40px 20px; color: #6b7280; }
  .empty-state i { font-size: 3rem; margin-bottom: 16px; color: #d1d5db; }
  .empty-state h3 { margin: 0 0 8px 0; color: #374151; }
  .empty-state p { margin: 0; color: #6b7280; }
`;
document.head.appendChild(style);

const successAlertStyle = document.createElement("style");
successAlertStyle.textContent = `
  .ticket-success-alert { text-align: left; padding: 10px 0; }
  .success-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; justify-content: center; }
  .success-header i { font-size: 2rem; color: #10b981; }
  .success-header h3 { margin: 0; color: #065f46; font-size: 1.4rem; }
  .ticket-details { background: white; border-radius: 8px; padding: 15px; margin: 15px 0; border: 1px solid #e5e7eb; }
  .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { font-weight: 600; color: #374151; }
  .detail-value { color: #6b7280; }
  .ticket-code { font-weight: bold; color: #ef070a; font-size: 1.1em; }
  .success-message { background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px; margin-top: 15px; }
  .success-message p { margin: 5px 0; color: #065f46; }
  .swal2-popup { border-radius: 12px !important; }
  .swal2-timer-progress-bar { background: #ef070a !important; }
`;
document.head.appendChild(successAlertStyle);

const deleteConfirmationStyle = document.createElement("style");
deleteConfirmationStyle.textContent = `
  .delete-confirmation { text-align: left; padding: 0 1rem; }
  .swal2-popup { background: var(--white) !important; color: var(--black); border: 1px solid var(--gray-200); padding: 1rem !important; }
  .swal2-title { color: var(--black); }
  .swal2-html-container { color: var(--black); margin: 0 !important; padding: 0 !important; }
  .swal2-actions { border-top: 1px solid var(--gray-200); margin-top: 12px; padding-top: 12px; }
  .delete-summary { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .delete-summary-row { display: contents; }
  .delete-field { color: var(--gray-600); font-weight: 600; }
  .delete-value { color: var(--black); text-align: right; }
  .delete-confirmation .form-group { margin: 0; }
  .swal2-textarea { width: 100% !important; box-sizing: border-box; margin: 0 !important; background: var(--white); color: var(--black); border: 1px solid var(--gray-200); border-radius: 8px; }
  html[data-theme='dark'] .swal2-textarea { background: var(--gray-100); color: var(--black); border-color: var(--gray-300); }
  .warning-text { color: #dc2626; font-weight: 600; margin: 10px 0; }
  .delete-success { text-align: center; }
  .delete-success i { font-size: 3rem; margin-bottom: 15px; }
  .text-success { color: #10b981; }
`;
document.head.appendChild(deleteConfirmationStyle);

const dashboardAnimStyle = document.createElement("style");
dashboardAnimStyle.textContent = `
  @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .ticket-item { will-change: opacity, transform; }
  .ticket-item.animate-in { animation: fadeSlideIn 220ms ease-out both; }
  .load-more-container.animate-in { animation: fadeSlideIn 200ms ease-out both; }
  .btn-secondary:hover { transform: translateY(-1px); }
`;
document.head.appendChild(dashboardAnimStyle);

const responsiveStyle = document.createElement("style");
responsiveStyle.textContent = `
  @media (max-width: 768px) {
    .tickets-table-wrap, #userTicketsTableContainer { display: none !important; }
    .tickets-list { display: block !important; }
    .load-more-container button { margin: 0.25rem; }
    .ticket-item { margin-bottom: 0.75rem; }
  }
`;
document.head.appendChild(responsiveStyle);
