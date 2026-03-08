document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDynamicForm();
    initQueryForm();
    initExportModal();
    initTeacherModal();
    initEditModal();
    initLeaveReasonModal();
    initScheduleModal();
    initAutoFill();
});

// --- Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const sections = document.querySelectorAll('.content-section');

    const shutdownBtn = document.getElementById('shutdown-system-btn');
    if (shutdownBtn) {
        shutdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('確定要關閉系統嗎？\n這將會完全終止背景的伺服器程式，關閉後您可以安全地關閉此瀏覽器視窗。')) {
                document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family: sans-serif; flex-direction:column; background-color: #f3f4f6; color: #1f2937;"><h2 style="font-size: 24px; font-weight: 600;">系統已關閉</h2><p style="color: #6b7280; margin-top: 10px;">背景伺服器已安全終止，您可以直接關閉此瀏覽器分頁了。</p></div>';
                fetch('/api/shutdown', { method: 'POST' }).catch(err => console.error(err));
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Do not override visibility for buttons meant only to trigger modals or actions
            if (item.id === 'manage-teachers-btn' || item.id === 'manage-leave-reasons-btn' || item.id === 'manage-schedules-btn' || item.id === 'shutdown-system-btn') {
                return;
            }

            e.preventDefault();

            // Remove active class from all nav items and sections
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => {
                s.style.display = 'none';
                s.classList.remove('active');
            });

            // Add active class to clicked nav item and target section
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
                // Trigger reflow for animation
                void targetSection.offsetWidth;
                targetSection.classList.add('active');
            }
        });
    });
}

// Global reference for Auto-Fill to use
window.appendNewDetailRow = null;

// --- Dynamic Form (Add/Remove details) ---
function initDynamicForm() {
    const container = document.getElementById('details-container');
    const template = document.getElementById('substitute-row-template');
    const form = document.getElementById('record-form');
    const resetBtn = document.getElementById('reset-form-btn');

    window.appendNewDetailRow = function () {
        if (!container || !template) return null;
        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.detail-row');

        // Remove button logic
        const removeBtn = row.querySelector('.remove-detail-btn');
        removeBtn.addEventListener('click', () => {
            row.remove();
        });

        // Sync hidden checkbox for proper form submission array alignment
        const moeCheckbox = row.querySelector('input[name="is_moe_subsidized_chk[]"]');
        const moeHiddenInput = row.querySelector('.hidden-cb-sync');
        if (moeCheckbox && moeHiddenInput) {
            moeCheckbox.addEventListener('change', (e) => {
                moeHiddenInput.value = e.target.checked ? 'true' : 'false';
                // Disable actual checkbox value from submitting to avoid array mismatch
                e.target.name = e.target.checked ? 'is_moe_subsidized_chk[]' : '';
            });
        }

        // Swap (調課) toggle logic
        const swapCheckbox = row.querySelector('.swap-checkbox');
        const swapHiddenInput = row.querySelector('.hidden-swap-sync');
        const teacherInput = row.querySelector('input[name="substitute_teacher[]"]');
        if (swapCheckbox && swapHiddenInput && teacherInput) {
            swapCheckbox.addEventListener('change', (e) => {
                const isSwapped = e.target.checked;
                swapHiddenInput.value = isSwapped ? 'true' : 'false';
                e.target.name = isSwapped ? 'is_swapped_chk[]' : '';

                // UI feedback
                if (isSwapped) {
                    teacherInput.value = '';
                    teacherInput.readOnly = true;
                    teacherInput.removeAttribute('required');
                    teacherInput.placeholder = '調課不需代課';
                    row.style.backgroundColor = '#f3f4f6'; // Gray out
                    row.style.opacity = '0.8';
                } else {
                    teacherInput.readOnly = false;
                    teacherInput.setAttribute('required', 'required');
                    teacherInput.placeholder = '姓名';
                    row.style.backgroundColor = '';
                    row.style.opacity = '1';
                }
            });
        }

        // Date Picker Sync & ROC Formatting
        const dateInput = row.querySelector('.sub-date-input');
        const hiddenDate = row.querySelector('.sub-date-hidden');
        if (dateInput && hiddenDate) {
            dateInput.addEventListener('change', (e) => {
                if (!e.target.value) {
                    hiddenDate.value = '';
                    dateInput.dataset.displayValue = ''; // Clear display if using custom CSS approach
                    return;
                }
                const date = new Date(e.target.value);
                const rocYear = date.getFullYear() - 1911;
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[date.getDay()];

                hiddenDate.value = `${rocYear}/${month}/${day}(${weekday})`;
                // If the UI relies on a pseudo element for display:
                dateInput.dataset.displayValue = `${rocYear}/${month}/${day}(${weekday})`;
            });
        }

        // Period Count Auto Calculation
        const periodsInput = row.querySelector('.sub-periods-input');
        const countInput = row.querySelector('.sub-period-count');
        if (periodsInput && countInput) {
            periodsInput.addEventListener('input', (e) => {
                countInput.value = calculatePeriods(e.target.value);
            });
        }

        container.appendChild(clone);
        return container.lastElementChild;
    };

    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => {
            if (confirm('確定要清除所有已填寫的資料嗎？')) {
                form.reset();
                container.innerHTML = '';
            }
        }, 10);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '儲存中...';

        try {
            const formData = new FormData(form);
            const response = await fetch('/api/records', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert('儲存成功！');
                form.reset();
                container.innerHTML = '';
            } else {
                alert('儲存失敗：' + (result.error || '未知錯誤'));
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('系統發生錯誤，請稍後再試。');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '儲存全部紀錄';
        }
    });
}

// --- Query Form ---
function initQueryForm() {
    const form = document.getElementById('query-form');
    const tbody = document.querySelector('#results-table tbody');
    const selectAllCb = document.getElementById('select-all-cb');
    const exportBtn = document.getElementById('open-export-modal-btn');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');

    // Current query results
    window.currentQueryData = [];

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const searchParams = new URLSearchParams(new FormData(form));

        try {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">查詢中...</td></tr>';

            const response = await fetch(`/api/records?${searchParams.toString()}`);
            const data = await response.json();

            window.currentQueryData = data;
            renderTable(data);

        } catch (error) {
            console.error('Query error:', error);
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">查詢失敗，請重試</td></tr>';
        }
    });

    selectAllCb.addEventListener('change', (e) => {
        const checkboxes = tbody.querySelectorAll('.row-cb');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateExportBtnState();
    });

    function renderTable(data) {
        selectAllCb.checked = false;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">查無相符資料</td></tr>';
            updateExportBtnState();
            return;
        }

        tbody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="row-cb" value="${item.id}" data-type="sub" data-teacher="${escapeHtml(item.substitute_teacher)}"></td>
                <td>${escapeHtml(item.leave_record.teacher_name)}</td>
                <td>${escapeHtml(item.leave_record.approval_number || '-')}</td>
                <td>${escapeHtml(item.substitute_date)}</td>
                <td>${escapeHtml(item.substitute_teacher)}</td>
                <td>${escapeHtml(item.periods)}</td>
                <td>${escapeHtml(item.subject)}</td>
                <td>${escapeHtml(item.class_name)}</td>
                <td>${item.period_count}</td>
                <td>${item.is_moe_subsidized ? '✅' : '-'}</td>
                <td style="text-align: center;">${item.is_swapped ? '<span class="badge" style="background-color: var(--secondary-color); color: white; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.75rem;">(調課)</span>' : '-'}</td>
                <td>
                    <button type="button" class="btn btn-outline btn-sm edit-btn" style="color: var(--primary-color); border-color: var(--primary-color); padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 4px;">編輯</button>
                    <button type="button" class="btn btn-outline btn-sm delete-btn" data-id="${item.id}" style="color: var(--danger-color); border-color: var(--danger-color); padding: 0.25rem 0.5rem; font-size: 0.75rem;">刪除</button>
                </td>
            `;

            // Add change listener to row checkbox
            row.querySelector('.row-cb').addEventListener('change', updateExportBtnState);

            // Add click listener to edit button
            row.querySelector('.edit-btn').addEventListener('click', () => {
                openEditModal(item, form);
            });

            // Add click listener to delete button
            row.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const recordId = e.target.getAttribute('data-id');
                const targetBtn = e.target;

                setTimeout(async () => {
                    if (confirm('確定要刪除這筆代課紀錄嗎？')) {
                        targetBtn.disabled = true;
                        targetBtn.textContent = '刪除中...';

                        try {
                            const response = await fetch(`/api/records/${recordId}`, { method: 'DELETE' });
                            if (response.ok) {
                                // Re-trigger search to refresh table
                                form.dispatchEvent(new Event('submit'));
                            } else {
                                alert('刪除失敗');
                                targetBtn.disabled = false;
                                targetBtn.textContent = '刪除';
                            }
                        } catch (err) {
                            console.error(err);
                            alert('刪除發生錯誤');
                            targetBtn.disabled = false;
                            targetBtn.textContent = '刪除';
                        }
                    }
                }, 10);
            });

            tbody.appendChild(row);
        });

        updateExportBtnState();
    }

    function updateExportBtnState() {
        const checkedBoxes = tbody.querySelectorAll('.row-cb:checked');
        const count = checkedBoxes.length;

        exportBtn.disabled = count === 0;
        exportBtn.textContent = `匯出勾選項目 (${count})`;

        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = count === 0;
            batchDeleteBtn.textContent = `批次刪除 (${count})`;
        }
    }

    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('#results-table tbody .row-cb:checked');
            if (checkedBoxes.length === 0) return;

            if (!confirm(`確定要刪除勾選的 ${checkedBoxes.length} 筆代課紀錄嗎？(刪除後無法復原)`)) {
                return;
            }

            batchDeleteBtn.disabled = true;
            batchDeleteBtn.textContent = '刪除中...';

            const ids = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            try {
                const response = await fetch('/api/records/batch', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids })
                });

                if (response.ok) {
                    alert(`成功刪除 ${ids.length} 筆紀錄`);
                    form.dispatchEvent(new Event('submit'));
                } else {
                    const errorData = await response.json();
                    alert(`批次刪除失敗: ${errorData.error || '未知錯誤'}`);
                }
            } catch (error) {
                console.error('Batch delete error:', error);
                alert('批次刪除發生錯誤，請稍後再試。');
            } finally {
                updateExportBtnState();
            }
        });
    }
}

// --- Edit Record Modal Logic ---
function initEditModal() {
    const modal = document.getElementById('edit-record-modal');
    const closeBtn = document.getElementById('close-edit-modal-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-edit-btn');

    const closeHandler = () => {
        modal.classList.remove('show');
    };

    closeBtn.addEventListener('click', closeHandler);
    cancelBtn.addEventListener('click', closeHandler);

    saveBtn.addEventListener('click', async () => {
        const id = document.getElementById('edit-record-id').value;
        const data = {
            leave_teacher: document.getElementById('edit-leave-teacher').value.trim(),
            leave_reason: document.getElementById('edit-leave-reason').value,
            approval_number: document.getElementById('edit-approval-number').value.trim(),
            substitute_date: document.getElementById('edit-sub-date').value.trim(),
            substitute_teacher: document.getElementById('edit-sub-teacher').value.trim(),
            periods: document.getElementById('edit-periods').value.trim(),
            period_count: document.getElementById('edit-period-count').value,
            subject: document.getElementById('edit-subject').value.trim(),
            class_name: document.getElementById('edit-class-name').value.trim(),
            remarks: document.getElementById('edit-remarks').value.trim(),
            is_moe_subsidized: document.getElementById('edit-is-moe').checked,
            is_swapped: document.getElementById('edit-is-swapped').checked
        };

        saveBtn.disabled = true;
        saveBtn.textContent = '儲存中...';

        try {
            const res = await fetch(`/api/records/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                modal.classList.remove('show');
                // Re-trigger query search to update table
                document.getElementById('query-form').dispatchEvent(new Event('submit'));
            } else {
                const errData = await res.json();
                alert(errData.error || '更新失敗');
            }
        } catch (err) {
            console.error(err);
            alert('發生錯誤');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '儲存修改';
        }
    });
}

function openEditModal(item, queryForm) {
    const modal = document.getElementById('edit-record-modal');

    // Populate fields
    document.getElementById('edit-record-id').value = item.id;
    document.getElementById('edit-leave-teacher').value = item.leave_record.teacher_name;
    document.getElementById('edit-leave-reason').value = item.leave_record.leave_reason;
    document.getElementById('edit-approval-number').value = item.leave_record.approval_number || '';

    document.getElementById('edit-sub-date').value = item.substitute_date;
    document.getElementById('edit-sub-teacher').value = item.substitute_teacher;
    document.getElementById('edit-periods').value = item.periods;
    document.getElementById('edit-period-count').value = item.period_count;
    document.getElementById('edit-subject').value = item.subject;
    document.getElementById('edit-class-name').value = item.class_name;
    document.getElementById('edit-remarks').value = item.remarks || '';
    document.getElementById('edit-is-moe').checked = item.is_moe_subsidized;

    const swapCheckbox = document.getElementById('edit-is-swapped');
    const teacherInput = document.getElementById('edit-sub-teacher');

    // Set initial state based on DB value
    swapCheckbox.checked = item.is_swapped;
    if (item.is_swapped) {
        teacherInput.value = '';
        teacherInput.readOnly = true;
        teacherInput.removeAttribute('required');
        teacherInput.placeholder = '調課不需代課';
    } else {
        teacherInput.readOnly = false;
        teacherInput.setAttribute('required', 'required');
        teacherInput.placeholder = '姓名';
    }

    // Bind event listener to modal toggle
    swapCheckbox.onchange = (e) => {
        const isSwapped = e.target.checked;
        if (isSwapped) {
            teacherInput.value = '';
            teacherInput.readOnly = true;
            teacherInput.removeAttribute('required');
            teacherInput.placeholder = '調課不需代課';
        } else {
            teacherInput.readOnly = false;
            teacherInput.setAttribute('required', 'required');
            teacherInput.placeholder = '姓名';
        }
    };

    modal.classList.add('show');
}

// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSelectedIds() {
    const checkedBoxes = document.querySelectorAll('#results-table tbody .row-cb:checked');
    return Array.from(checkedBoxes).map(cb => cb.value);
}

function calculatePeriods(periodStr) {
    if (!periodStr) return 0;

    // Remove all spaces
    periodStr = periodStr.replace(/\s+/g, '');

    // Split by commas
    const parts = periodStr.split(',');
    let totalCount = 0;

    for (const part of parts) {
        if (!part) continue;

        // Handle range like "2-4" or "2~4"
        const rangeMatch = part.match(/^(\d+)[-~](\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                totalCount += (end - start + 1);
            }
        } else {
            // Handle single number or time ranges (we just count comma separated chunks for complex strings like 12:25-13:10 as 1)
            // But since the user wants 2,3,6 to evaluate to 3, each comma part that isn't a range counts as 1.
            totalCount += 1;
        }
    }

    return totalCount;
}

// --- Export Modal ---
function initExportModal() {
    const modal = document.getElementById('export-modal');
    const openBtn = document.getElementById('open-export-modal-btn');
    const closeBtn = document.querySelector('.close-btn');
    const cancelBtn = document.getElementById('cancel-export');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    const deductionsTbody = document.querySelector('#deductions-table tbody');
    const previewListTbody = document.querySelector('#preview-list-table tbody');

    const confirmListBtn = document.getElementById('confirm-export-list');
    const confirmPaymentBtn = document.getElementById('confirm-export-payment');

    // Live calculation logic
    function recalculateRow(tr) {
        const totalPeriods = parseInt(tr.dataset.periods || 0);
        const unitPrice = parseInt(document.getElementById('export-unit-price').value || 0);

        const expectedVal = totalPeriods * unitPrice;
        tr.querySelector('.calc-expected').textContent = expectedVal;

        const health = parseInt(tr.querySelector('.teacher-health-ins').value || 0);
        const labor = parseInt(tr.querySelector('.teacher-labor-ins').value || 0);

        const actualVal = expectedVal - health - labor;
        tr.querySelector('.calc-actual').textContent = actualVal;
    }

    openBtn.addEventListener('click', () => {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) return;

        const checkedBoxes = document.querySelectorAll('#results-table tbody .row-cb:checked');

        // --- Populate Substitute List Preview ---
        previewListTbody.innerHTML = '';
        const selectedRowsData = [];

        checkedBoxes.forEach(cb => {
            const row = cb.closest('tr');
            // Extract text from the visible table cells
            const cells = row.querySelectorAll('td');

            // Skip swapped classes completely from ALL export previews
            const isSwapped = cells[10].textContent.includes('(調課)');
            if (isSwapped) return;

            selectedRowsData.push({
                leave_teacher: cells[1].textContent,
                approval_info: cells[2].textContent,
                sub_date: cells[3].textContent,
                sub_teacher: cells[4].textContent,
                periods: cells[5].textContent,
                subject: cells[6].textContent,
                class_name: cells[7].textContent,
                period_count: parseInt(cells[8].textContent) || 0,
                remarks: cells[11] && cells[11].querySelector('.edit-btn') ? '' : '' // Hack: we didn't render remarks in the main view
            });
        });

        // Just mirror the visible data for now
        selectedRowsData.forEach(data => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(data.leave_teacher)}</td>
                <td>${escapeHtml(data.approval_info)}</td>
                <td>${escapeHtml(data.sub_date)}</td>
                <td>${escapeHtml(data.sub_teacher)}</td>
                <td>${escapeHtml(data.periods)}</td>
                <td>${escapeHtml(data.subject)}</td>
                <td>${escapeHtml(data.class_name)}</td>
                <td>${data.period_count}</td>
                <td></td>
            `;
            previewListTbody.appendChild(tr);
        });

        // --- Populate Payment Receipt (Deductions) Preview ---
        const teacherTotals = {};
        selectedRowsData.forEach(data => {
            if (!teacherTotals[data.sub_teacher]) teacherTotals[data.sub_teacher] = 0;
            teacherTotals[data.sub_teacher] += data.period_count;
        });

        deductionsTbody.innerHTML = '';
        Object.entries(teacherTotals).forEach(([teacher, totalPeriods]) => {
            const tr = document.createElement('tr');
            tr.dataset.periods = totalPeriods;
            tr.innerHTML = `
                <td>${escapeHtml(teacher)}</td>
                <td>${totalPeriods}</td>
                <td class="calc-expected text-primary" style="font-weight: bold;">0</td>
                <td style="padding: 0.4rem 0.5rem;"><input type="number" class="teacher-health-ins" data-teacher="${escapeHtml(teacher)}" value="0" min="0" style="width: 100%; padding:0.4rem; font-size: 0.9rem;"></td>
                <td style="padding: 0.4rem 0.5rem;"><input type="number" class="teacher-labor-ins" data-teacher="${escapeHtml(teacher)}" value="0" min="0" style="width: 100%; padding:0.4rem; font-size: 0.9rem;"></td>
                <td class="calc-actual" style="font-weight: bold; color: var(--success-color);">0</td>
            `;

            deductionsTbody.appendChild(tr);

            // Add live calculation listeners
            const inputs = tr.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', () => recalculateRow(tr));
            });

            // Initial calculation
            recalculateRow(tr);
        });

        // Add listener for unit price changes to update all rows
        document.getElementById('export-unit-price').addEventListener('input', () => {
            deductionsTbody.querySelectorAll('tr').forEach(tr => recalculateRow(tr));
        });

        // Show first tab by default
        tabBtns[0].click();
        modal.classList.add('show');
    });

    const closeModal = () => modal.classList.remove('show');
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    confirmListBtn.addEventListener('click', () => triggerExport('list'));
    confirmPaymentBtn.addEventListener('click', () => triggerExport('payment'));

    function triggerExport(type) {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) {
            alert('請先勾選要匯出的資料');
            closeModal();
            return;
        }

        const unitPrice = document.getElementById('export-unit-price').value || 455;

        // Serialize teacher deductions
        const teacherDeductions = {};
        const healthInputs = document.querySelectorAll('.teacher-health-ins');
        const laborInputs = document.querySelectorAll('.teacher-labor-ins');

        healthInputs.forEach(input => {
            const teacher = input.dataset.teacher;
            if (!teacherDeductions[teacher]) teacherDeductions[teacher] = {};
            teacherDeductions[teacher].health = parseInt(input.value) || 0;
        });

        laborInputs.forEach(input => {
            const teacher = input.dataset.teacher;
            if (!teacherDeductions[teacher]) teacherDeductions[teacher] = {};
            teacherDeductions[teacher].labor = parseInt(input.value) || 0;
        });

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/api/export/${type}`;

        // Append IDs
        selectedIds.forEach(id => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'record_ids[]';
            input.value = id;
            form.appendChild(input);
        });

        // Append configuration
        const params = {
            unit_price: unitPrice,
            teacher_deductions: JSON.stringify(teacherDeductions)
        };
        for (const [key, value] of Object.entries(params)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        closeModal();
    }
}

// --- Teacher Management Modal ---
function initTeacherModal() {
    const modal = document.getElementById('teacher-modal');
    const openBtn = document.getElementById('manage-teachers-btn');
    const closeBtn = document.getElementById('close-teacher-modal-btn');
    const addBtn = document.getElementById('add-teacher-btn');
    const nameInput = document.getElementById('new-teacher-name');
    const tbody = document.querySelector('#teachers-table tbody');

    // Make the sidebar button stay active when clicked
    openBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Update sidebar UI state
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        openBtn.classList.add('active');

        // Hide other sections technically not needed if modal is full overlay, but good practice
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        modal.classList.add('show');
        loadTeachers();
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');

        // Simple hack: Re-click the first nav item to reset view
        document.querySelector('.sidebar-nav .nav-item[data-target="input-section"]').click();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBtn.click();
        }
    });

    addBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (res.ok) {
                nameInput.value = '';
                loadTeachers();
            } else {
                const data = await res.json();
                alert(data.error || '新增失敗');
            }
        } catch (err) {
            console.error(err);
            alert('新增發生錯誤');
        }
    });

    async function loadTeachers() {
        try {
            const res = await fetch('/api/teachers');
            const teachers = await res.json();

            tbody.innerHTML = '';

            if (teachers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">目前尚無名單</td></tr>';
                return;
            }

            teachers.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(t.name)}</td>
                    <td>
                        <button type="button" class="btn btn-outline btn-sm delete-teacher-btn" data-id="${t.id}" style="color: var(--danger-color); border-color: var(--danger-color); padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            刪除
                        </button>
                    </td>
                `;

                tr.querySelector('.delete-teacher-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.target.getAttribute('data-id');
                    const targetBtn = e.target;

                    setTimeout(async () => {
                        if (confirm(`確定要刪除「${t.name}」嗎？這不會刪除歷史紀錄。`)) {
                            targetBtn.disabled = true;
                            try {
                                const delRes = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
                                if (delRes.ok) {
                                    loadTeachers();
                                } else {
                                    alert('刪除失敗');
                                    targetBtn.disabled = false;
                                }
                            } catch (err) {
                                console.error(err);
                                alert('刪除發生錯誤');
                                targetBtn.disabled = false;
                            }
                        }
                    }, 10);
                });

                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="color:red;">載入失敗</td></tr>';
        }
    }
}

// --- Leave Reason Management Modal ---
function initLeaveReasonModal() {
    const modal = document.getElementById('leave-reason-modal');
    const openBtn = document.getElementById('manage-leave-reasons-btn');
    const closeBtn = document.getElementById('close-leave-reason-modal-btn');
    const addBtn = document.getElementById('add-leave-reason-btn');
    const nameInput = document.getElementById('new-leave-reason-name');
    const tbody = document.querySelector('#leave-reasons-table tbody');

    // Make the sidebar button stay active when clicked
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Update sidebar UI state
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
                item.classList.remove('active');
            });
            openBtn.classList.add('active');

            // Hide other sections technically not needed if modal is full overlay, but good practice
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });

            modal.classList.add('show');
            loadLeaveReasons();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');

            // Reload page to reflect dynamic leave reasons in dropdowns instantly
            window.location.reload();
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBtn.click();
        }
    });

    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;

            try {
                const res = await fetch('/api/leave_reasons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });

                if (res.ok) {
                    nameInput.value = '';
                    loadLeaveReasons();
                } else {
                    const data = await res.json();
                    alert(data.error || '新增失敗');
                }
            } catch (err) {
                console.error(err);
                alert('新增發生錯誤');
            }
        });
    }

    async function loadLeaveReasons() {
        try {
            const res = await fetch('/api/leave_reasons');
            const reasons = await res.json();

            tbody.innerHTML = '';

            if (reasons.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">目前尚無名單</td></tr>';
                return;
            }

            reasons.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(t.name)}</td>
                    <td>
                        <button type="button" class="btn btn-outline btn-sm delete-reason-btn" data-id="${t.id}" style="color: var(--danger-color); border-color: var(--danger-color); padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            刪除
                        </button>
                    </td>
                `;

                tr.querySelector('.delete-reason-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.target.getAttribute('data-id');
                    const targetBtn = e.target;

                    setTimeout(async () => {
                        if (confirm(`確定要刪除「${t.name}」嗎？這不會刪除歷史紀錄。`)) {
                            targetBtn.disabled = true;
                            try {
                                const delRes = await fetch(`/api/leave_reasons/${id}`, { method: 'DELETE' });
                                if (delRes.ok) {
                                    loadLeaveReasons();
                                } else {
                                    alert('刪除失敗');
                                    targetBtn.disabled = false;
                                }
                            } catch (err) {
                                console.error(err);
                                alert('刪除發生錯誤');
                                targetBtn.disabled = false;
                            }
                        }
                    }, 10);
                });

                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="color:red;">載入失敗</td></tr>';
        }
    }
}

// --- Teacher Schedule Management Modal ---
function initScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    console.log("DUMPING MODAL HTML:", modal ? modal.innerHTML : "NULL");

    const openBtn = document.getElementById('manage-schedules-btn');
    const closeBtn = document.getElementById('close-schedule-modal-btn');

    // View containers
    const listView = document.getElementById('schedule-list-view');
    const editView = document.getElementById('schedule-edit-view');
    const footer = document.getElementById('schedule-modal-footer');

    // List elements
    const listBody = document.querySelector('#schedules-list-table tbody');
    const newScheduleBtn = document.getElementById('new-schedule-btn');

    // Edit form elements
    const cancelBtn = document.getElementById('cancel-schedule-btn');
    const saveBtn = document.getElementById('save-schedule-btn');
    const deleteBtn = document.getElementById('delete-schedule-btn'); // Restored
    const tbody = document.getElementById('schedule-tbody');
    const teacherSelect = document.getElementById('schedule-teacher-select');
    const startDateInput = document.getElementById('schedule-start-date');
    const endDateInput = document.getElementById('schedule-end-date');

    let currentScheduleId = null;

    if (!modal) return;

    // --- View Switching ---
    function showListView() {
        listView.style.display = 'block';
        editView.style.display = 'none';
        footer.style.display = 'none';
        loadSchedulesList();
    }

    function showEditView() {
        listView.style.display = 'none';
        editView.style.display = 'block';
        footer.style.display = 'flex';
    }

    // --- List Logic ---
    async function loadSchedulesList() {
        listBody.innerHTML = '<tr><td colspan="2" class="text-center">載入中...</td></tr>';

        try {
            const res = await fetch('/api/schedules');
            const schedules = await res.json();
            listBody.innerHTML = '';

            if (schedules.length === 0) {
                listBody.innerHTML = '<tr><td colspan="2" class="text-center" style="color: var(--text-secondary);">目前沒有設定任何老師課表</td></tr>';
                return;
            }

            schedules.forEach(sch => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 500; color: var(--text-color);">${sch.teacher_name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">(${sch.start_date} ~ ${sch.end_date})</div>
                    </td>
                    <td style="text-align: right;">
                         <button type="button" class="btn btn-primary btn-sm edit-sch-btn" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem;" data-id="${sch.id}">
                            編輯
                        </button>
                        <button type="button" class="btn btn-outline btn-sm delete-sch-btn" style="color: var(--danger-color); border-color: var(--danger-color); padding: 0.25rem 0.5rem; font-size: 0.8rem;" data-id="${sch.id}" data-name="${sch.teacher_name}">
                            刪除
                        </button>
                    </td>
                `;

                tr.querySelector('.edit-sch-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    loadScheduleIntoEdit(sch);
                });

                tr.querySelector('.delete-sch-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.target.getAttribute('data-id');
                    const name = e.target.getAttribute('data-name');

                    // Delay native confirm slightly to escape current event loop and prevent instant dismissal bug
                    setTimeout(async () => {
                        if (confirm(`確定要刪除 ${name} 的課表嗎？這不會影響已經存檔的代課紀錄。`)) {
                            try {
                                const delRes = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
                                if (delRes.ok) {
                                    loadSchedulesList();
                                } else {
                                    alert('刪除失敗');
                                }
                            } catch (err) {
                                console.error(err);
                                alert('發生錯誤');
                            }
                        }
                    }, 10);
                });

                listBody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
            listBody.innerHTML = '<tr><td colspan="2" class="text-center" style="color:red;">載入失敗</td></tr>';
        }
    }


    // --- Edit Grid Logic ---
    function renderGrid() {
        tbody.innerHTML = '';
        for (let period = 1; period <= 7; period++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="text-align: center; font-weight: bold; background: #f8fafc; border-right: 1px solid #e5e7eb; padding: 0.2rem;">第 ${period} 節</td>`;

            for (let day = 1; day <= 5; day++) {
                tr.innerHTML += `
                    <td style="padding: 0.2rem; vertical-align: top; border-right: 1px solid #e5e7eb; transition: background-color 0.2s;">
                        <input type="text" class="sch-subj form-control" data-day="${day}" data-period="${period}" placeholder="科目" style="padding: 0.15rem 0.25rem; font-size: 0.85rem; margin-bottom: 0.15rem; width: 100%; box-sizing: border-box;">
                        <input type="text" class="sch-class form-control" data-day="${day}" data-period="${period}" placeholder="班級" style="padding: 0.15rem 0.25rem; font-size: 0.85rem; margin-bottom: 0.15rem; width: 100%; box-sizing: border-box;">
                        <label class="checkbox-label" style="font-size: 0.75rem; display: flex; align-items: center; justify-content: flex-end; width: 100%; margin-bottom: 0;">
                            <input type="checkbox" class="sch-moe" data-day="${day}" data-period="${period}" style="width: 0.8rem; height: 0.8rem; margin-right: 0.25rem;">
                            <span style="color: var(--text-secondary);">超鐘點</span>
                        </label>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        }

        // Add event listeners to toggle highlight
        const updateCellBg = (input) => {
            const td = input.closest('td');
            if (!td) return;
            const subj = td.querySelector('.sch-subj').value.trim();
            const cls = td.querySelector('.sch-class').value.trim();
            if (subj || cls) {
                td.style.backgroundColor = '#FEF9C3'; // Conspicuous Light yellow highlight
            } else {
                td.style.backgroundColor = '';
            }
        };

        tbody.querySelectorAll('.sch-subj, .sch-class').forEach(input => {
            input.addEventListener('input', () => updateCellBg(input));
        });
    }

    function loadScheduleIntoEdit(sch) {
        renderGrid();

        currentScheduleId = sch.id;
        teacherSelect.value = sch.teacher_name;
        startDateInput.value = sch.start_date;
        endDateInput.value = sch.end_date;

        sch.periods.forEach(p => {
            const subjInput = document.querySelector(`.sch-subj[data-day="${p.day_of_week}"][data-period="${p.period_num}"]`);
            const classInput = document.querySelector(`.sch-class[data-day="${p.day_of_week}"][data-period="${p.period_num}"]`);
            const moeInput = document.querySelector(`.sch-moe[data-day="${p.day_of_week}"][data-period="${p.period_num}"]`);

            if (subjInput) {
                subjInput.value = p.subject;
                subjInput.dispatchEvent(new Event('input'));
            }
            if (classInput) {
                classInput.value = p.class_name;
                classInput.dispatchEvent(new Event('input'));
            }
            if (moeInput) moeInput.checked = p.is_moe_subsidized;
        });

        showEditView();
    }

    // Modal Triggers
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Do not hide .content-section, it breaks the background

            showListView();
            modal.classList.add('show');
        });
    }

    const closeModal = () => {
        modal.classList.remove('show');
        document.getElementById('input-nav-btn').click();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Generate empty form
    if (newScheduleBtn) {
        newScheduleBtn.addEventListener('click', () => {
            currentScheduleId = null;
            teacherSelect.value = '';
            startDateInput.value = '';
            endDateInput.value = '';
            renderGrid();
            showEditView();
        });
    }

    // Cancel edit
    if (cancelBtn) cancelBtn.addEventListener('click', showListView);

    // Save Edit
    saveBtn.addEventListener('click', async () => {
        const teacher = teacherSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!teacher || !startDate || !endDate) {
            alert('請選擇教師並設定生效起迄日');
            return;
        }

        if (startDate > endDate) {
            alert('開始日不能大於結束日');
            return;
        }

        const periods = [];
        for (let day = 1; day <= 5; day++) {
            for (let period = 1; period <= 7; period++) {
                const subj = document.querySelector(`.sch-subj[data-day="${day}"][data-period="${period}"]`).value.trim();
                const cls = document.querySelector(`.sch-class[data-day="${day}"][data-period="${period}"]`).value.trim();
                const moe = document.querySelector(`.sch-moe[data-day="${day}"][data-period="${period}"]`).checked;

                if (subj || cls) {
                    periods.push({
                        day_of_week: day,
                        period_num: period,
                        subject: subj || '無',
                        class_name: cls || '無',
                        is_moe_subsidized: moe
                    });
                }
            }
        }

        saveBtn.disabled = true;
        try {
            // Note: Since API endpoint is purely insert/overwrite by teacher_name & range for MVP,
            // POST /api/schedules automatically handles update logic vs insert logic on backend.
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_name: teacher,
                    start_date: startDate,
                    end_date: endDate,
                    periods: periods
                })
            });

            if (res.ok) {
                alert('課表儲存成功！');
                showListView();
            } else {
                const data = await res.json();
                alert(data.error || '儲存失敗');
            }
        } catch (err) {
            console.error(err);
            alert('發生錯誤');
        } finally {
            saveBtn.disabled = false;
        }
    });
}

// --- Auto-Fill based on Teacher Schedule ---
function initAutoFill() {
    const autoFillBtn = document.getElementById('auto-fill-btn');
    if (!autoFillBtn) return;

    autoFillBtn.addEventListener('click', async () => {
        const teacherName = document.getElementById('teacher_name').value.trim();
        const startDate = document.getElementById('leave-start-date').value;
        const startPeriod = document.getElementById('leave-start-period').value;
        const endDate = document.getElementById('leave-end-date').value;
        const endPeriod = document.getElementById('leave-end-period').value;

        if (!teacherName) {
            alert('請先填寫上方「請假教師姓名」');
            return;
        }
        if (!startDate || !endDate || !startPeriod || !endPeriod) {
            alert('請完整填寫請假起訖日期與節次');
            return;
        }
        if (startDate > endDate || (startDate === endDate && parseInt(startPeriod) > parseInt(endPeriod))) {
            alert('開始時間不能大於結束時間');
            return;
        }

        autoFillBtn.disabled = true;
        const originalText = autoFillBtn.textContent;
        autoFillBtn.textContent = '載入中...';

        try {
            const res = await fetch(`/api/schedule/match?teacher_name=${encodeURIComponent(teacherName)}&start_date=${startDate}&start_period=${startPeriod}&end_date=${endDate}&end_period=${endPeriod}`);
            const matches = await res.json();

            if (res.ok) {
                if (matches.length === 0) {
                    alert('在此區間內找不到這位教師的課表設定，無法自動帶出。');
                } else {
                    matches.forEach(m => {
                        // Create the row using the global helper
                        const newRow = window.appendNewDetailRow();
                        if (!newRow) return;

                        // Populate the fields
                        const dateInput = newRow.querySelector('.sub-date-input');
                        const periodsInput = newRow.querySelector('.sub-periods-input');
                        const periodCountInput = newRow.querySelector('.sub-period-count');
                        const subjectInput = newRow.querySelector('input[name="subject[]"]');
                        const clsInput = newRow.querySelector('input[name="class_name[]"]');
                        const moeCheckbox = newRow.querySelector('input[name="is_moe_subsidized_chk[]"]');

                        dateInput.value = m.substitute_date_raw;
                        periodsInput.value = m.period_num.toString();
                        periodCountInput.value = 1;
                        subjectInput.value = m.subject;
                        clsInput.value = m.class_name;
                        moeCheckbox.checked = m.is_moe_subsidized;

                        const teacherInput = newRow.querySelector('input[name="substitute_teacher[]"]');

                        // Handle Existing Substitutes Overlap
                        if (m.existing_sub) {
                            teacherInput.value = m.existing_sub;

                            // Visual indication it's already filled
                            newRow.style.opacity = '0.65';
                            newRow.style.pointerEvents = 'none';
                            newRow.style.backgroundColor = '#f3f4f6'; // Light gray

                            // Add a visual badge next to the remove button
                            const removeBtn = newRow.querySelector('.remove-detail-btn');
                            if (removeBtn) {
                                removeBtn.style.display = 'none'; // Prevent removing the dummy row
                                const badge = document.createElement('span');
                                badge.textContent = '已排代';
                                badge.style.color = 'var(--text-secondary)';
                                badge.style.fontSize = '0.75rem';
                                badge.style.fontWeight = 'bold';
                                badge.style.position = 'absolute';
                                badge.style.right = '0.5rem';
                                badge.style.top = '0.5rem';
                                newRow.style.position = 'relative';
                                newRow.appendChild(badge);
                            }

                            // Strip name attributes so these inputs aren't submitted with the form
                            newRow.querySelectorAll('input, select').forEach(input => {
                                input.removeAttribute('name');
                            });
                        } else {
                            // Leave the "Substitute Teacher" field blank for new records
                            teacherInput.value = '';
                        }

                        // Dispatch events to trigger recalculations and hidden input syncing
                        dateInput.dispatchEvent(new Event('change'));
                        periodsInput.dispatchEvent(new Event('input'));
                        moeCheckbox.dispatchEvent(new Event('change'));
                    });
                }
            } else {
                alert(matches.error || '自動帶出發生錯誤');
            }
        } catch (err) {
            console.error(err);
            alert('網路或伺服器錯誤');
        } finally {
            autoFillBtn.disabled = false;
            autoFillBtn.textContent = originalText;
        }
    });
}

