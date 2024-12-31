export const metadata = {
  command: "qse",
  name: "Quick Start Express",
  version: "v1.0.4-beta",
  description:
    "A simple CLI tool to generate Express servers from multiple available templates.",
  oneLineDescription: "A simple Express.js server generator CLI tool.",
};

export const commands = {
  version: {
    command: "-v, --version",
    description: "Prints current qse version",
  },
  init: {
    command: "init",
    description: "Initialize a new Express server.",
    options: [
      {
        flags: "-t, --template <template>",
        description: "Specify template to use",
      },
      {
        flags: "-n, --name <name>",
        description: "Specify the name of the package",
      },
    ],
  },
  list: {
    command: "list",
    description: "List all available commands and options.",
  },
  clear: {
    command: "clear",
    description: "Clear the directory.",
  },
};

export const templates = {
  basic: {
    name: "basic",
  },
  express_pg_sequelize: {
    name: "express_pg_sequelize",
  },
  express_mysql: {
    name: "express_mysql",
  },
  express_prisma: {
    name: "express_prisma",
    dependencies: [
      {
        name: "express",
        version: "^4.17.1",
      },
      {
        name: "@prisma/client",
        version: "^6.1.0",
      },
      {
        name: "nodemon",
        version: "^3.1.9",
      },
      {
        name: "@types/node",
        version: "^22.10.2"
      },
      {
        name: "dotenv",
        version: "^16.4.7"
      }
    ],
  }
};
