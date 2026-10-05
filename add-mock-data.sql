-- Add mock email messages for testing
INSERT INTO email_messages (
    id, graph_message_id, conversation_id, internet_message_id,
    received_at, sender_email, sender_name, subject,
    is_read, importance, has_attachments, classification,
    body_preview, web_link, first_seen_at, last_seen_at
) VALUES 
-- New unread messages (last 24 hours)
(
    'msg-001',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDEAAA=',
    'conversation-001',
    '<msg001@example.com>',
    datetime('now', '-2 hours'),
    'john.smith@techcorp.com',
    'John Smith',
    'Q4 Budget Review Meeting - Action Items',
    0,
    'high',
    1,
    'important',
    'Hi Reinier, Following up on our Q4 budget review meeting. Please review the attached spreadsheet with proposed allocations for next quarter. We need your approval by Friday.',
    'https://outlook.office365.com/mail/inbox/id/msg-001',
    datetime('now', '-2 hours'),
    datetime('now', '-2 hours')
),
(
    'msg-002',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDFAAA=',
    'conversation-002',
    '<msg002@example.com>',
    datetime('now', '-5 hours'),
    'sarah.johnson@designstudio.com',
    'Sarah Johnson',
    'Project Phoenix - Design Mockups Ready',
    0,
    'normal',
    1,
    'new',
    'Hey! The design mockups for Project Phoenix are ready for your review. I''ve uploaded them to the shared drive. Let me know if you need any changes!',
    'https://outlook.office365.com/mail/inbox/id/msg-002',
    datetime('now', '-5 hours'),
    datetime('now', '-5 hours')
),
(
    'msg-003',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDGAAA=',
    'conversation-003',
    '<msg003@example.com>',
    datetime('now', '-8 hours'),
    'michael.chen@consulting.com',
    'Michael Chen',
    'Re: Quarterly Report Data Request',
    0,
    'normal',
    0,
    'new',
    'I''ve compiled the data you requested for the quarterly report. The numbers look good overall, with revenue up 23% YoY. See details below...',
    'https://outlook.office365.com/mail/inbox/id/msg-003',
    datetime('now', '-8 hours'),
    datetime('now', '-8 hours')
),

-- Important messages from this week
(
    'msg-004',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDHAAA=',
    'conversation-004',
    '<msg004@example.com>',
    datetime('now', '-2 days'),
    'ceo@company.com',
    'Lisa Anderson',
    'Company All-Hands Next Week',
    1,
    'high',
    0,
    'important',
    'Team, reminder that we have our quarterly all-hands meeting next Tuesday at 10 AM. Please come prepared with your department updates.',
    'https://outlook.office365.com/mail/inbox/id/msg-004',
    datetime('now', '-2 days'),
    datetime('now', '-2 days')
),
(
    'msg-005',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDIAAA=',
    'conversation-005',
    '<msg005@example.com>',
    datetime('now', '-3 days'),
    'hr@company.com',
    'HR Department',
    'Benefits Open Enrollment Deadline - October 15th',
    1,
    'high',
    1,
    'important',
    'This is a reminder that the benefits open enrollment period closes on October 15th. Please review your options and submit your selections.',
    'https://outlook.office365.com/mail/inbox/id/msg-005',
    datetime('now', '-3 days'),
    datetime('now', '-3 days')
),

-- Marketing messages
(
    'msg-006',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDJAAA=',
    'conversation-006',
    '<msg006@marketing.com>',
    datetime('now', '-10 hours'),
    'news@techcrunch.com',
    'TechCrunch',
    'Daily Newsletter: AI Breakthroughs and Startup News',
    1,
    'low',
    0,
    'marketing',
    'Your daily dose of tech news. Top stories: New AI model beats GPT-4, startup raises $50M Series B, and more...',
    'https://outlook.office365.com/mail/inbox/id/msg-006',
    datetime('now', '-10 hours'),
    datetime('now', '-10 hours')
),
(
    'msg-007',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAEMAAChY0qBvVxGTZhRiNL_SqaOAAC94UDKAAA=',
    'conversation-007',
    '<msg007@marketing.com>',
    datetime('now', '-15 hours'),
    'offers@amazon.com',
    'Amazon',
    'Today Only: 40% Off Electronics',
    1,
    'low',
    0,
    'marketing',
    'Limited time offer on electronics. Shop laptops, tablets, headphones and more. Sale ends tonight at midnight!',
    'https://outlook.office365.com/mail/inbox/id/msg-007',
    datetime('now', '-15 hours'),
    datetime('now', '-15 hours')
);

-- Add mock calendar events
INSERT INTO calendar_events (
    id, graph_event_id, subject, start_at, end_at,
    timezone, location, organiser, response_status,
    is_cancelled, body_preview, first_seen_at, last_seen_at
) VALUES
-- Today's events
(
    'evt-001',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD0AAA=',
    'Team Standup',
    datetime('now', 'start of day', '+9 hours'),
    datetime('now', 'start of day', '+9 hours', '+30 minutes'),
    'South Africa Standard Time',
    'Teams Meeting',
    'sarah.johnson@company.com',
    'accepted',
    0,
    'Daily team standup to sync on progress and blockers.',
    datetime('now', '-1 day'),
    datetime('now', '-1 day')
),
(
    'evt-002',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD1AAA=',
    'Client Review Meeting - Project Phoenix',
    datetime('now', 'start of day', '+14 hours'),
    datetime('now', 'start of day', '+15 hours'),
    'South Africa Standard Time',
    'Conference Room B',
    'john.smith@company.com',
    'accepted',
    0,
    'Review project deliverables with the client. Bring updated mockups and timeline.',
    datetime('now', '-2 days'),
    datetime('now', '-2 days')
),
(
    'evt-003',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD2AAA=',
    'Coffee Chat with Michael',
    datetime('now', 'start of day', '+16 hours'),
    datetime('now', 'start of day', '+16 hours', '+30 minutes'),
    'South Africa Standard Time',
    'Coffee Shop - Ground Floor',
    'michael.chen@company.com',
    'accepted',
    0,
    'Informal catch-up to discuss career development and mentorship.',
    datetime('now', '-3 days'),
    datetime('now', '-3 days')
),

-- Upcoming events (next 7 days)
(
    'evt-004',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD3AAA=',
    'Q4 Planning Workshop',
    datetime('now', '+2 days', 'start of day', '+10 hours'),
    datetime('now', '+2 days', 'start of day', '+13 hours'),
    'South Africa Standard Time',
    'Boardroom',
    'ceo@company.com',
    'tentative',
    0,
    'Strategic planning session for Q4 objectives and key results. All department heads required.',
    datetime('now', '-1 day'),
    datetime('now', '-1 day')
),
(
    'evt-005',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD4AAA=',
    'Doctor Appointment',
    datetime('now', '+3 days', 'start of day', '+8 hours'),
    datetime('now', '+3 days', 'start of day', '+9 hours'),
    'South Africa Standard Time',
    'Medical Centre, 123 Main St',
    'reinier.olivier@gmail.com',
    'none',
    0,
    'Annual checkup with Dr. Williams.',
    datetime('now', '-5 days'),
    datetime('now', '-5 days')
),
(
    'evt-006',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD5AAA=',
    'Lunch with Sarah - Project Discussion',
    datetime('now', '+4 days', 'start of day', '+12 hours'),
    datetime('now', '+4 days', 'start of day', '+13 hours'),
    'South Africa Standard Time',
    'Italian Restaurant',
    'sarah.johnson@company.com',
    'accepted',
    0,
    'Lunch meeting to discuss new project ideas and potential collaboration.',
    datetime('now', '-2 days'),
    datetime('now', '-2 days')
),
(
    'evt-007',
    'AAMkAGI2TGMYZY2LThmOTktNDcwYS05OGViLWM3ZjI1YzQ1NjRmZQBGAAAAAAClrfKmJvhIR8_lJ8qXBaVsBwChY0qBvVxGTZhRiNL_SqaOAAAAAAENAAChY0qBvVxGTZhRiNL_SqaOAAC94UD6AAA=',
    'Company All-Hands Meeting',
    datetime('now', '+6 days', 'start of day', '+10 hours'),
    datetime('now', '+6 days', 'start of day', '+11 hours', '+30 minutes'),
    'South Africa Standard Time',
    'Main Auditorium / Teams',
    'ceo@company.com',
    'accepted',
    0,
    'Quarterly company update covering financials, product roadmap, and team announcements. Attendance required.',
    datetime('now', '-1 day'),
    datetime('now', '-1 day')
);

-- Update sync_state to show we have data
UPDATE sync_state 
SET 
    status = 'complete',
    last_success_at = datetime('now'),
    messages_checked = 7,
    pagination_complete = 1,
    updated_at = datetime('now')
WHERE source = 'email';

UPDATE sync_state 
SET 
    status = 'complete',
    last_success_at = datetime('now'),
    events_checked = 7,
    pagination_complete = 1,
    updated_at = datetime('now')
WHERE source = 'calendar';
