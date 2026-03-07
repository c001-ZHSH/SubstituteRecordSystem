from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Teacher(db.Model):
    __tablename__ = 'teachers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class LeaveReason(db.Model):
    __tablename__ = 'leave_reasons'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class LeaveRecord(db.Model):
    __tablename__ = 'leave_records'
    id = db.Column(db.Integer, primary_key=True)
    teacher_name = db.Column(db.String(50), nullable=False)
    leave_reason = db.Column(db.String(100), nullable=False)
    approval_number = db.Column(db.String(100), nullable=True) # 公假才需要
    substitute_records = db.relationship('SubstituteRecord', backref='leave_record', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'teacher_name': self.teacher_name,
            'leave_reason': self.leave_reason,
            'approval_number': self.approval_number,
            'substitute_records': [sub.to_dict() for sub in self.substitute_records]
        }

class SubstituteRecord(db.Model):
    __tablename__ = 'substitute_records'
    id = db.Column(db.Integer, primary_key=True)
    leave_record_id = db.Column(db.Integer, db.ForeignKey('leave_records.id'), nullable=False)
    substitute_date = db.Column(db.String(20), nullable=False) # 中華民國/月/日(星期)
    substitute_teacher = db.Column(db.String(50), nullable=False)
    periods = db.Column(db.String(50), nullable=False) # 節次 e.g. 1-4, 12:25-13:10
    subject = db.Column(db.String(50), nullable=False) # 科目
    class_name = db.Column(db.String(50), nullable=False) # 班級
    period_count = db.Column(db.Integer, nullable=False) # 節數
    remarks = db.Column(db.String(200), nullable=True) # 備註
    is_moe_subsidized = db.Column(db.Boolean, default=False) # 是否為教育部補助超終點
    is_swapped = db.Column(db.Boolean, default=False) # 是否為調課

    def to_dict(self):
        return {
            'id': self.id,
            'leave_record_id': self.leave_record_id,
            'substitute_date': self.substitute_date,
            'substitute_teacher': self.substitute_teacher,
            'periods': self.periods,
            'subject': self.subject,
            'class_name': self.class_name,
            'period_count': self.period_count,
            'remarks': self.remarks,
            'is_moe_subsidized': self.is_moe_subsidized,
            'is_swapped': self.is_swapped
        }

class TeacherSchedule(db.Model):
    __tablename__ = 'teacher_schedules'
    id = db.Column(db.Integer, primary_key=True)
    teacher_name = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.String(20), nullable=False) # e.g. 115/02/01
    end_date = db.Column(db.String(20), nullable=False)   # e.g. 115/06/30
    periods = db.relationship('SchedulePeriod', backref='schedule', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'teacher_name': self.teacher_name,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'periods': [p.to_dict() for p in self.periods]
        }

class SchedulePeriod(db.Model):
    __tablename__ = 'schedule_periods'
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.Integer, db.ForeignKey('teacher_schedules.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False) # 1 (Mon) to 5 (Fri)
    period_num = db.Column(db.Integer, nullable=False) # 1 to 7
    subject = db.Column(db.String(50), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)
    is_moe_subsidized = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'schedule_id': self.schedule_id,
            'day_of_week': self.day_of_week,
            'period_num': self.period_num,
            'subject': self.subject,
            'class_name': self.class_name,
            'is_moe_subsidized': self.is_moe_subsidized
        }
