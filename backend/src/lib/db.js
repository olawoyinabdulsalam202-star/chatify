import mongoose from "mongoose"
import { ENV } from "./env.js";

// Mongoose queues operations while the driver is disconnected and replays them
// once it reconnects. Left unbounded that queue hides an outage behind requests
// that simply never answer, so cap the wait and let the route fail with a real
// error instead of hanging the client.
mongoose.set("bufferTimeoutMS", 10000);

export const connectDB = async () => {
  const { MONGO_URI } = ENV;

  // A missing URI is a config error, not a transient one — no amount of
  // retrying fixes it, so fail fast and loudly.
  if (!MONGO_URI) {
    console.error("FATAL: MONGO_URI is not defined in environment variables.");
    process.exit(1);
  }

  // Post-connection errors (Atlas failover, laptop sleep, wifi drop) arrive as
  // events on the connection emitter, not as a rejection from connect(). An
  // unhandled 'error' event would take the whole process down, so they're
  // logged here and left to the driver, which reconnects on its own.
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected — the driver will keep retrying.");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      // Fail in 10s rather than the 30s default, so a bad network or an
      // un-whitelisted IP surfaces quickly instead of looking like a hang.
      serverSelectionTimeoutMS: 10000,
    });
    console.log("MONGODB CONNECTED:", conn.connection.host);
    return true;
  } catch (error) {
    console.error("Error connecting to MONGODB:", error.message);

    // Atlas's own message is generic. These are the three causes that actually
    // produce it in practice, in the order they're worth checking.
    if (error.name === "MongooseServerSelectionError") {
      console.error(
        "\nCould not reach your MongoDB Atlas cluster. Usual causes:\n" +
          "  1. Your current IP isn't whitelisted — Atlas > Network Access > Add Current IP Address.\n" +
          "  2. The free (M0) cluster is paused after inactivity — open the Atlas dashboard and Resume it.\n" +
          "  3. DNS can't resolve the mongodb+srv record — some networks block the custom\n" +
          "     resolvers set in server.js (1.1.1.1 / 8.8.8.8); try commenting that line out.\n"
      );
    }

    // Deliberately NOT process.exit() here. Killing the process on a transient
    // network blip turns a brief outage into a crash-loop, and on Render that
    // means the HTTP port is dropped and every request 502s even after the
    // database comes back. Staying up lets the driver reconnect by itself and
    // keeps the failure legible instead of a restart cycle.
    console.error("Server is still running; it will keep retrying the database in the background.\n");
    return false;
  }
}