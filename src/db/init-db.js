const { initializeDatabase, DB_PATH } = require("./database");

initializeDatabase()
  .then(() => {
    console.log(`DB hazirdir: ${DB_PATH}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("DB initialize zamani xeta:", error);
    process.exit(1);
  });
