import { PrismaClient, Role, AssignmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Classes by Koustav database...");

  // 1. Create Tutor Admin
  const admin = await prisma.user.upsert({
    where: { email: "koustav@classesbykoustav.com" },
    update: {},
    create: {
      email: "koustav@classesbykoustav.com",
      name: "Koustav (Tutor)",
      role: Role.ADMIN,
      phone: "+91 91239 24645",
      className: "Tutor Faculty",
      profileComplete: true,
    },
  });

  // 2. Create Enrolled Students
  const student1 = await prisma.user.upsert({
    where: { email: "student1@example.com" },
    update: {},
    create: {
      email: "student1@example.com",
      name: "Rahul Sharma",
      role: Role.STUDENT,
      phone: "+91 98765 43210",
      className: "Class 10",
      profileComplete: true,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@example.com" },
    update: {},
    create: {
      email: "student2@example.com",
      name: "Priya Patel",
      role: Role.STUDENT,
      phone: "+91 98111 22334",
      className: "Class 12 - Science",
      profileComplete: true,
    },
  });

  const student3 = await prisma.user.upsert({
    where: { email: "student3@example.com" },
    update: {},
    create: {
      email: "student3@example.com",
      name: "Amit Kumar",
      role: Role.STUDENT,
      phone: "+91 98222 33445",
      className: "Class 11 - Science",
      profileComplete: true,
    },
  });

  // 3. Create Sample Assessment Tests
  const test1 = await prisma.test.create({
    data: {
      title: "Unit 3: Laws of Motion & Friction Assessment",
      subject: "Physics",
      description: "30 Multiple Choice Questions covering Newton's laws, impulse, friction, and circular dynamics.",
      iconName: "Atom",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfD_demo_physics_test/viewform",
      active: true,
    },
  });

  const test2 = await prisma.test.create({
    data: {
      title: "Periodic Classification & Chemical Bonding",
      subject: "Chemistry",
      description: "Sectional test on ionization energy, electronegativity, ionic/covalent bonds, and VSEPR theory.",
      iconName: "FlaskConical",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfD_demo_chemistry_test/viewform",
      active: true,
    },
  });

  const test3 = await prisma.test.create({
    data: {
      title: "Coordinate Geometry & Vector Algebra",
      subject: "Mathematics",
      description: "Class 10/11 standard revision test on straight lines, circles, and dot/cross vector products.",
      iconName: "Calculator",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfD_demo_maths_test/viewform",
      active: true,
    },
  });

  const test4 = await prisma.test.create({
    data: {
      title: "Cell Structure & Molecular Genetics",
      subject: "Biology",
      description: "Deactivated test for demonstration.",
      iconName: "Dna",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfD_demo_bio_test/viewform",
      active: false, // Inactive
    },
  });

  const test5 = await prisma.test.create({
    data: {
      title: "Electricity & Magnetic Effects Mid-Term",
      subject: "General Science",
      description: "Ohm's law, circuit analysis, magnetic fields, and electromagnetic induction.",
      iconName: "Sparkles",
      formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfD_demo_electricity_test/viewform",
      active: true,
    },
  });

  // 4. Create Sample Assignments for student1@example.com (demonstrating all 3 statuses: Available, Submitted, Closed)
  
  // A. Available test (due in 5 days)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const assign1 = await prisma.assignment.create({
    data: {
      testId: test1.id,
      studentEmail: "student1@example.com",
      dueAt: futureDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  // B. Submitted test with Result record
  const assign2 = await prisma.assignment.create({
    data: {
      testId: test2.id,
      studentEmail: "student1@example.com",
      dueAt: futureDate,
      status: AssignmentStatus.SUBMITTED,
    },
  });

  await prisma.result.create({
    data: {
      assignmentId: assign2.id,
      score: 46,
      maxScore: 50,
      responseEmail: "student1@example.com",
    },
  });

  // C. Closed test: Inactive test
  await prisma.assignment.create({
    data: {
      testId: test4.id,
      studentEmail: "student1@example.com",
      dueAt: futureDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  // D. Closed test: Past deadline
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 3);

  await prisma.assignment.create({
    data: {
      testId: test5.id,
      studentEmail: "student1@example.com",
      dueAt: pastDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  // E. Pre-assigned test to an unregistered email (proves email-keyed resolution!)
  await prisma.assignment.create({
    data: {
      testId: test1.id,
      studentEmail: "unregistered.candidate@gmail.com",
      dueAt: futureDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  // F. Assignments for student2 and student3
  await prisma.assignment.create({
    data: {
      testId: test1.id,
      studentEmail: "student2@example.com",
      dueAt: futureDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  await prisma.assignment.create({
    data: {
      testId: test3.id,
      studentEmail: "student3@example.com",
      dueAt: futureDate,
      status: AssignmentStatus.ASSIGNED,
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
