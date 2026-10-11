// This file creates and exports a single Prisma client instance for the whole app.
// Think of it like having one phone line to the database — every part of the
// app shares it, instead of each opening its own connection.
// NEW CONCEPT: A "singleton" means only one instance of something exists.
// PrismaClient connects to our database so we can read and write data.

import { PrismaClient } from "@prisma/client";

// Create the single Prisma client instance — our database connection
const prisma = new PrismaClient();

export default prisma;