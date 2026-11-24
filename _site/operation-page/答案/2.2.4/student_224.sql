use studentdb;
/*（1）编写SQL语句,建立数据完整性约束。为成绩表（grades）创建外键，
其学生编号去引用学生表（students）中的学生编号，
其课程编号去引用课程表（courses）中的课程编号。*/
alter table grades 
   add CONSTRAINT fk_grades_students 
   foreign key(student_id) references students(student_id),
   add CONSTRAINT fk_grades_courses 
   foreign key(course_id) references courses(course_id);
   
/*(2)编写SQL语句, 查询每位学生的平均成绩，要求显示学生编号和平均成绩。*/
SELECT student_id, AVG(grade) AS average_grade
FROM grades
GROUP BY student_id;

/*(3)编写SQL语句，查询选修了至少一门课程的学生数量。*/
SELECT COUNT(DISTINCT student_id) AS student_count
FROM grades;

/*(4)编写SQL语句，查询所有选修了课程编号为‘101’的学生姓名。*/
SELECT s.name
FROM students s
JOIN grades g ON s.student_id = g.student_id
WHERE g.course_id = 101;


/*(5)编写SQL语句，查询每门课程的平均成绩,要求显示课程名称和对应的平均成绩。*/
SELECT course_name, AVG(grade) AS average_grade
FROM courses
JOIN grades ON courses.course_id = grades.course_id
GROUP BY course_name;


/*(6)编写SQL语句，查询选修了课程编号为‘103’的课程且成绩在90分以上的学生姓名和成绩。*/
SELECT s.name, g.grade
FROM students s
JOIN grades g ON s.student_id = g.student_id
WHERE g.course_id = 103 AND g.grade > 90;


/*(7)编写SQL语句，查询每门课程的最高成绩，要求显示课程名称和对应的最高成绩。*/
SELECT c.course_name, MAX(g.grade) AS max_grade
FROM courses c
JOIN grades g ON c.course_id = g.course_id
JOIN students s ON g.student_id = s.student_id
GROUP BY c.course_name;


/*(8)编写SQL语句，查询没有选修任何课程的学生姓名。*/
SELECT name
FROM students
WHERE student_id NOT IN (SELECT student_id FROM grades);


/*(9)编写SQL语句，查询每门课程的平均学分，要求显示课程编号和平均学分。*/
SELECT course_id, AVG(credit_hours) AS avg_credit_hours
FROM courses
GROUP BY course_id;


/*(10)编写SQL语句，查询每门课程的选修学生中成绩最低的学生姓名、课程名称和成绩。*/
SELECT s.name, c.course_name,g.grade
FROM courses c
JOIN grades g ON c.course_id = g.course_id
JOIN students s ON g.student_id = s.student_id
WHERE (g.course_id, g.grade) IN (
    SELECT course_id, MIN(grade)
    FROM grades
    GROUP BY course_id
);