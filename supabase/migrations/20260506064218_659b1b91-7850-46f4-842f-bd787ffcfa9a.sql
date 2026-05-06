UPDATE jobs SET title = 'Trainer' WHERE title = 'Stage Trainer';
DELETE FROM jobs WHERE title IN ('Training Director','HR Manager','Operations Manager','QA Manager','IT Manager','Finance Manager','Recruitment Coordinator');
UPDATE jobs SET branch = 'Head Office' WHERE branch = 'Headquarters';
UPDATE branches SET name_en = 'Head Office', name_ar = 'الإدارة الرئيسية' WHERE name_en = 'Headquarters';