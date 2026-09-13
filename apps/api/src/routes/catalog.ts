import { Router } from "express";
import { clientConfig } from "../config.js";

export const catalogRouter = Router();

catalogRouter.get("/catalog", (_req, res) => {
  res.json(clientConfig);
});
