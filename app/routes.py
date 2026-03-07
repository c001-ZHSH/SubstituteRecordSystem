from flask import Blueprint, render_template, request, jsonify, send_file
from datetime import datetime
from .models import db, LeaveRecord, SubstituteRecord, Teacher, LeaveReason, TeacherSchedule, SchedulePeriod
from .utils import generate_substitute_list_excel, generate_payment_excel
import os
import re

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    # Get teachers from the dedicated master list
    master_teachers = [t.name for t in Teacher.query.all()]
    
    # Get unique teachers from historical records to ensure we don't miss any if the master list is empty initially
    leave_teachers = [t[0] for t in db.session.query(LeaveRecord.teacher_name).distinct().all()]
    sub_teachers = [t[0] for t in db.session.query(SubstituteRecord.substitute_teacher).distinct().all()]
    
    # Combine and sort, removing duplicates (now only using master_teachers per user request)
    all_teachers = sorted(master_teachers)
    
    # Get leave reasons
    leave_reasons = [r.name for r in LeaveReason.query.order_by(LeaveReason.id).all()]
    
    return render_template('index.html', teachers=all_teachers, master_teachers=master_teachers, leave_reasons=leave_reasons)

@bp.route('/api/records', methods=['POST'])
def create_record():
    try:
        data = request.form
        
        # 1. Create Master Record
        leave_record = LeaveRecord(
            teacher_name=data.get('teacher_name'),
            leave_reason=data.get('leave_reason'),
            approval_number=data.get('approval_number')
        )
        db.session.add(leave_record)
        db.session.flush() # To get leave_record.id

        # 2. Create Detail Records
        sub_dates = request.form.getlist('substitute_date[]')
        sub_teachers = request.form.getlist('substitute_teacher[]')
        periods_list = request.form.getlist('periods[]')
        subjects = request.form.getlist('subject[]')
        class_names = request.form.getlist('class_name[]')
        period_counts = request.form.getlist('period_count[]')
        remarks_list = request.form.getlist('remarks[]')
        is_moe_list = request.form.getlist('is_moe_subsidized[]')
        is_swapped_list = request.form.getlist('is_swapped[]')

        for i in range(len(sub_dates)):
            sub_record = SubstituteRecord(
                leave_record_id=leave_record.id,
                substitute_date=sub_dates[i],
                substitute_teacher=sub_teachers[i],
                periods=periods_list[i],
                subject=subjects[i],
                class_name=class_names[i],
                period_count=int(period_counts[i]),
                remarks=remarks_list[i] if i < len(remarks_list) else '',
                is_moe_subsidized=(is_moe_list[i] == 'true'),
                is_swapped=(is_swapped_list[i] == 'true' if i < len(is_swapped_list) else False)
            )
            db.session.add(sub_record)

        db.session.commit()
        return jsonify({'success': True, 'message': 'Record saved successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@bp.route('/api/records', methods=['GET'])
def get_records():
    query = SubstituteRecord.query.join(LeaveRecord)

    # Filters
    leave_teacher = request.args.get('leave_teacher')
    if leave_teacher:
        query = query.filter(LeaveRecord.teacher_name.like(f'%{leave_teacher}%'))

    sub_teacher = request.args.get('sub_teacher')
    if sub_teacher:
        query = query.filter(SubstituteRecord.substitute_teacher.like(f'%{sub_teacher}%'))

    # Fetch all matching teacher records first
    records = query.all()

    def parse_roc_date(roc_str):
        # Extracts 115/03/09 out of "115/03/09(一)" and converts to datetime
        match = re.search(r'(\d+)/(\d+)/(\d+)', roc_str)
        if match:
            roc_year = int(match.group(1))
            month = int(match.group(2))
            day = int(match.group(3))
            gregorian_year = roc_year + 1911
            try:
                return datetime(gregorian_year, month, day)
            except ValueError:
                return None
        return None

    filtered_records = []
    
    # Parse bounds
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    start_dt = None
    if start_date_str:
        try:
            start_dt = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            pass

    end_dt = None
    if end_date_str:
        try:
            end_dt = datetime.strptime(end_date_str, '%Y-%m-%d')
        except ValueError:
            pass

    for r in records:
        record_dt = parse_roc_date(r.substitute_date)
        
        # If we can parse the record's date, compare it against bounds
        if record_dt:
            if start_dt and record_dt < start_dt:
                continue
            if end_dt and record_dt > end_dt:
                continue
                
        filtered_records.append(r)

    result = []
    for r in filtered_records:
        data = r.to_dict()
        data['leave_record'] = r.leave_record.to_dict()
        result.append(data)

    return jsonify(result)

@bp.route('/api/export/list', methods=['POST'])
def export_list():
    record_ids = request.form.getlist('record_ids[]')
    if not record_ids:
        return "No records selected", 400

    records = SubstituteRecord.query.filter(SubstituteRecord.id.in_(record_ids)).all()
    
    # Generate Excel
    file_path = generate_substitute_list_excel(records)
    
    return send_file(file_path, as_attachment=True, download_name='代課清單.xlsx')

@bp.route('/api/export/payment', methods=['POST'])
def export_payment():
    import json
    record_ids = request.form.getlist('record_ids[]')
    unit_price = int(request.form.get('unit_price', 455))
    
    teacher_deductions_str = request.form.get('teacher_deductions', '{}')
    try:
        teacher_deductions = json.loads(teacher_deductions_str)
    except:
        teacher_deductions = {}

    if not record_ids:
        return "No records selected", 400

    records = SubstituteRecord.query.filter(SubstituteRecord.id.in_(record_ids)).all()
    
    # Generate Excel
    file_path = generate_payment_excel(records, unit_price, teacher_deductions)
    
    return send_file(file_path, as_attachment=True, download_name='印領清冊.xlsx')

@bp.route('/api/records/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    sub_record = SubstituteRecord.query.get_or_404(record_id)
    
    # Check if this is the last substitute record for the leave record
    leave_record = sub_record.leave_record
    
    db.session.delete(sub_record)
    
    # If the leave record has no more substitute records, delete it too
    if len(leave_record.substitute_records) == 0:
        db.session.delete(leave_record)
        
    db.session.commit()
    return jsonify({"message": "Record deleted successfully"}), 200

@bp.route('/api/records/batch', methods=['DELETE'])
def batch_delete_records():
    try:
        data = request.json
        record_ids = data.get('ids', [])
        if not record_ids:
            return jsonify({"error": "No IDs provided"}), 400

        records_to_delete = SubstituteRecord.query.filter(SubstituteRecord.id.in_(record_ids)).all()
        leave_records_to_check = set()

        for sub_record in records_to_delete:
            leave_records_to_check.add(sub_record.leave_record)
            db.session.delete(sub_record)

        db.session.flush()

        for leave_record in leave_records_to_check:
            remaining = SubstituteRecord.query.filter_by(leave_record_id=leave_record.id).count()
            if remaining == 0:
                db.session.delete(leave_record)

        db.session.commit()
        return jsonify({"message": f"{len(records_to_delete)} records deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/api/records/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    try:
        data = request.json
        sub_record = SubstituteRecord.query.get_or_404(record_id)
        leave_record = sub_record.leave_record

        # Update Master Record fields if provided
        if 'leave_teacher' in data:
            leave_record.teacher_name = data['leave_teacher']
        if 'leave_reason' in data:
            leave_record.leave_reason = data['leave_reason']
        if 'approval_number' in data:
            leave_record.approval_number = data['approval_number']

        # Update Substitute Record fields if provided
        if 'substitute_date' in data:
            sub_record.substitute_date = data['substitute_date']
        if 'substitute_teacher' in data:
            sub_record.substitute_teacher = data['substitute_teacher']
        if 'periods' in data:
            sub_record.periods = data['periods']
        if 'subject' in data:
            sub_record.subject = data['subject']
        if 'class_name' in data:
            sub_record.class_name = data['class_name']
        if 'period_count' in data:
            sub_record.period_count = int(data['period_count'])
        if 'remarks' in data:
            sub_record.remarks = data['remarks']
        if 'is_moe_subsidized' in data:
            sub_record.is_moe_subsidized = bool(data['is_moe_subsidized'])
        if 'is_swapped' in data:
            sub_record.is_swapped = bool(data['is_swapped'])

        db.session.commit()
        return jsonify({"message": "Record updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

# --- Teacher Master List API ---
@bp.route('/api/teachers', methods=['GET'])
def get_teachers():
    teachers = Teacher.query.order_by(Teacher.name).all()
    return jsonify([t.to_dict() for t in teachers])

@bp.route('/api/teachers', methods=['POST'])
def add_teacher():
    data = request.json
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Teacher name cannot be empty'}), 400
        
    existing = Teacher.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': 'Teacher already exists'}), 400
        
    new_teacher = Teacher(name=name)
    db.session.add(new_teacher)
    db.session.commit()
    
    return jsonify(new_teacher.to_dict()), 201

@bp.route('/api/teachers/<int:teacher_id>', methods=['DELETE'])
def delete_teacher(teacher_id):
    teacher = Teacher.query.get_or_404(teacher_id)
    db.session.delete(teacher)
    db.session.commit()
    return jsonify({'success': True})

# --- Leave Reason Management API ---
@bp.route('/api/leave_reasons', methods=['GET'])
def get_leave_reasons():
    reasons = LeaveReason.query.order_by(LeaveReason.id).all()
    return jsonify([r.to_dict() for r in reasons])

@bp.route('/api/leave_reasons', methods=['POST'])
def add_leave_reason():
    data = request.json
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Leave reason cannot be empty'}), 400
        
    existing = LeaveReason.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': 'Leave reason already exists'}), 400
        
    new_reason = LeaveReason(name=name)
    db.session.add(new_reason)
    db.session.commit()
    
    return jsonify(new_reason.to_dict()), 201

@bp.route('/api/leave_reasons/<int:reason_id>', methods=['DELETE'])
def delete_leave_reason(reason_id):
    reason = LeaveReason.query.get_or_404(reason_id)
    db.session.delete(reason)
    db.session.commit()
    return jsonify({'success': True})

# --- Teacher Schedule & Auto-Fill API ---
@bp.route('/api/schedules', methods=['POST'])
def save_schedule():
    data = request.json
    teacher_name = data.get('teacher_name')
    start_date = data.get('start_date') # YYYY-MM-DD
    end_date = data.get('end_date') # YYYY-MM-DD
    periods = data.get('periods', []) # list of dicts

    if not all([teacher_name, start_date, end_date]):
        return jsonify({'error': 'Missing required fields'}), 400

    existing = TeacherSchedule.query.filter_by(teacher_name=teacher_name, start_date=start_date, end_date=end_date).first()
    if existing:
        db.session.delete(existing)
        db.session.flush()

    new_schedule = TeacherSchedule(
        teacher_name=teacher_name,
        start_date=start_date,
        end_date=end_date
    )
    db.session.add(new_schedule)
    db.session.flush()

    for p in periods:
        period = SchedulePeriod(
            schedule_id=new_schedule.id,
            day_of_week=p['day_of_week'],
            period_num=p['period_num'],
            subject=p['subject'],
            class_name=p['class_name'],
            is_moe_subsidized=p.get('is_moe_subsidized', False)
        )
        db.session.add(period)

    db.session.commit()
    return jsonify(new_schedule.to_dict()), 201

@bp.route('/api/schedules', methods=['GET'])
def get_schedules():
    teacher_name = request.args.get('teacher_name')
    if teacher_name:
        schedules = TeacherSchedule.query.filter_by(teacher_name=teacher_name).all()
    else:
        schedules = TeacherSchedule.query.all()
    return jsonify([s.to_dict() for s in schedules])

@bp.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    schedule = TeacherSchedule.query.get_or_404(schedule_id)
    db.session.delete(schedule)
    db.session.commit()
    return jsonify({'success': True})

from datetime import timedelta
import re

def parse_periods_string(p_str):
    nums = set()
    parts = p_str.replace(' ', '').split(',')
    for part in parts:
        if '-' in part:
            try:
                st, en = part.split('-')
                if st.isdigit() and en.isdigit():
                    nums.update(range(int(st), int(en)+1))
            except: pass
        elif part.isdigit():
            nums.add(int(part))
    return nums

@bp.route('/api/schedule/match', methods=['GET'])
def match_schedule():
    teacher_name = request.args.get('teacher_name')
    start_date_str = request.args.get('start_date') # YYYY-MM-DD
    start_period = int(request.args.get('start_period', 1))
    end_date_str = request.args.get('end_date') # YYYY-MM-DD
    end_period = int(request.args.get('end_period', 7))

    if not all([teacher_name, start_date_str, end_date_str]):
        return jsonify({'error': 'Missing parameters'}), 400

    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

    schedules = TeacherSchedule.query.filter_by(teacher_name=teacher_name).all()

    # Pre-fetch existing substitute records for this teacher to prevent duplicates
    # Since substitute_date is stored as 'YYY/MM/DD(Day)' we need to query by join or fetch all and filter
    # To be safe and efficient enough for MVP, we'll fetch all records for the leave teacher
    # by joining LeaveRecord and filtering by teacher_name
    existing_subs_query = db.session.query(SubstituteRecord).join(LeaveRecord).filter(
        LeaveRecord.teacher_name == teacher_name
    ).all()
    
    # Build a lookup map: { 'YYYY-MM-DD': { period_num: sub_teacher_name } }
    existing_lookup = {}
    for sub in existing_subs_query:
        # sub.substitute_date format: "115/03/06(五)" -> Extract YYYY-MM-DD
        match = re.search(r'(\d+)/(\d+)/(\d+)', sub.substitute_date)
        if match:
            y, m, d = match.groups()
            gregorian_y = int(y) + 1911
            iso_date = f"{gregorian_y}-{int(m):02d}-{int(d):02d}"
            
            p_set = parse_periods_string(sub.periods)
            if iso_date not in existing_lookup:
                existing_lookup[iso_date] = {}
            for p_num in p_set:
                existing_lookup[iso_date][p_num] = sub.substitute_teacher

    matches = []
    current_date = start_date
    weekdays_zh = ['一', '二', '三', '四', '五', '六', '日']
    
    while current_date <= end_date:
        weekday = current_date.isoweekday() 
        if weekday > 5: # Skip weekends
            current_date += timedelta(days=1)
            continue
            
        active_schedule = None
        for s in schedules:
            s_start = datetime.strptime(s.start_date, '%Y-%m-%d').date()
            s_end = datetime.strptime(s.end_date, '%Y-%m-%d').date()
            if s_start <= current_date <= s_end:
                active_schedule = s
                break
                
        if active_schedule:
            p_start = start_period if current_date == start_date else 1
            p_end = end_period if current_date == end_date else 7
            iso_current = current_date.strftime('%Y-%m-%d')
            
            for period in active_schedule.periods:
                if period.day_of_week == weekday and p_start <= period.period_num <= p_end:
                    roc_year = current_date.year - 1911
                    date_formatted = f"{roc_year}/{current_date.month:02d}/{current_date.day:02d}({weekdays_zh[weekday-1]})"
                    
                    # Check for overlap
                    existing_sub = None
                    if iso_current in existing_lookup and period.period_num in existing_lookup[iso_current]:
                        existing_sub = existing_lookup[iso_current][period.period_num]

                    # We also want to pass back the YYYY-MM-DD format for hidden inputs
                    match_data = {
                        'substitute_date_display': date_formatted,
                        'substitute_date_raw': iso_current,
                        'period_num': period.period_num,
                        'subject': period.subject,
                        'class_name': period.class_name,
                        'is_moe_subsidized': period.is_moe_subsidized
                    }
                    
                    if existing_sub:
                        match_data['existing_sub'] = existing_sub
                        
                    matches.append(match_data)
                    
        current_date += timedelta(days=1)

    # Sort matches by date then period
    matches.sort(key=lambda x: (x['substitute_date_raw'], x['period_num']))

    return jsonify(matches)
