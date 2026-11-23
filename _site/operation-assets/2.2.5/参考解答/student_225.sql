use studentdb;
/*（1）编写SQL语句,建立数据完整性约束。为成绩表（grades）
创建外键，其学生编号去引用学生表（students）中的学生编号，
其课程编号去引用课程表（courses）中的课程编号。*/

alter table grades
add constraint fk_grades_students
foreign key(student_id) references students(student_id),
add constraint fk_grades_courses
foreign key(course_id) references courses(course_id);




/*（2）编写SQL语句, 查询年龄在20岁以上的学生的姓名和年龄。*/

SELECT name, age FROM students WHERE age > 20;



/*（3）编写SQL语句，查询每个等级所对应的学生数量，要求显示等级及对应等级的学生数量。*/

SELECT grade, COUNT(*) AS student_count
FROM students
GROUP BY grade;



/*（4）编写SQL语句，查询选修了Mathematics课程的学生姓名和年龄，要求按年龄降序排序。*/

select s.name,s.age from grades g,courses c,students s 
 where g.course_id = c.course_id and c.course_name='Mathematics' 
 and g.student_id = s.student_id order by s.age desc;


/*（5）编写SQL语句，查询选修了Mathematics课程的学生姓名和年龄，要求按年龄降序排序。*/
SELECT s.name, SUM(c.credit_hours) AS total_credits
FROM students s
LEFT JOIN grades g ON s.student_id = g.student_id
LEFT JOIN courses c ON g.course_id = c.course_id
GROUP BY s.student_id;

/*（6）编写SQL语句，查询没有选修Physics课程的学生姓名和年龄。*/

SELECT s.name, s.age
FROM students s
WHERE student_id NOT in (
    SELECT student_id from grades g, courses c where g.course_id=c.course_id  and c.course_name='Physics'
);

/*（7）编写SQL语句，查询选修了至少一门课程的学生数量。*/

SELECT COUNT(DISTINCT student_id) AS student_count FROM grades;


/*（8）编写SQL语句，查询每门课程的选修学生数量，输出课程编号和对应的学生数量。*/

SELECT course_id, COUNT(student_id) AS student_count
FROM grades
GROUP BY course_id;

/*（9）编写SQL语句，查询每门课程的平均学分，要求显示课程编号和平均学分。*/
SELECT course_id, AVG(credit_hours) AS avg_credit_hours
FROM courses
GROUP BY course_id;


/*（10）编写SQL语句，查询选修了课程编号为‘102’的课程但没有选修课程编号为‘103’的课程的学生姓名。*/

SELECT s.name
FROM students s
WHERE s.student_id IN (SELECT student_id FROM grades WHERE course_id = 102)
  AND s.student_id NOT IN (SELECT student_id FROM grades WHERE course_id = 103);



