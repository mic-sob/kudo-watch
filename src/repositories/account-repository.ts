import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AccountLink } from "../domain/account-link.js";
import type { OAuthSession } from "../domain/oauth-session.js";

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const linkKey = (discordUserId: string) => ({
  PK: `DISCORD#${discordUserId}`,
  SK: "LINK",
});

const ownerKey = (stravaAthleteId: number) => ({
  PK: `STRAVA#${stravaAthleteId}`,
  SK: "OWNER",
});

const oauthKey = (state: string) => ({
  PK: `OAUTH#${state}`,
  SK: "SESSION",
});

export class StravaAccountAlreadyLinkedError extends Error {
  public constructor() {
    super("This Strava account is already linked to another Discord account.");
    this.name = "StravaAccountAlreadyLinkedError";
  }
}

export type ActivityClaimResult = "claimed" | "published" | "busy";

export class AccountRepository {
  public constructor(private readonly tableName: string) {}

  public async createOAuthSession(session: OAuthSession): Promise<void> {
    await documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...oauthKey(session.state),
          entityType: "OAUTH_SESSION",
          discordUserId: session.discordUserId,
          discordGuildId: session.discordGuildId,
          discordDisplayName: session.discordDisplayName,
          expiresAt: session.expiresAt,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  }

  public async getOAuthSession(state: string): Promise<OAuthSession | undefined> {
    const response = await documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: oauthKey(state),
        ConsistentRead: true,
      }),
    );

    return this.parseOAuthSession(state, response.Item);
  }

  public async consumeOAuthSession(
    state: string,
  ): Promise<OAuthSession | undefined> {
    const response = await documentClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: oauthKey(state),
        ReturnValues: "ALL_OLD",
      }),
    );

    return this.parseOAuthSession(state, response.Attributes);
  }

  public async getAccountLink(
    discordUserId: string,
  ): Promise<AccountLink | undefined> {
    const response = await documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: linkKey(discordUserId),
        ConsistentRead: true,
      }),
    );

    return this.parseAccountLink(response.Item);
  }

  public async findAccountLinkByStravaAthleteId(
    stravaAthleteId: number,
  ): Promise<AccountLink | undefined> {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
        ExpressionAttributeValues: {
          ":pk": `STRAVA#${stravaAthleteId}`,
          ":sk": "LINK",
        },
        Limit: 1,
      }),
    );

    return this.parseAccountLink(response.Items?.[0]);
  }

  public async deactivateAccountLink(
    discordUserId: string,
    stravaAthleteId: number,
  ): Promise<void> {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: linkKey(discordUserId),
              UpdateExpression:
                "SET #status = :inactive, updatedAt = :updatedAt REMOVE encryptedAccessToken, encryptedRefreshToken, GSI1PK, GSI1SK",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":inactive": "inactive",
                ":updatedAt": new Date().toISOString(),
              },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Delete: {
              TableName: this.tableName,
              Key: ownerKey(stravaAthleteId),
              ConditionExpression: "discordUserId = :discordUserId",
              ExpressionAttributeValues: {
                ":discordUserId": discordUserId,
              },
            },
          },
        ],
      }),
    );
  }

  public async updateStravaTokens(input: {
    readonly discordUserId: string;
    readonly previousEncryptedRefreshToken: string;
    readonly encryptedAccessToken: string;
    readonly encryptedRefreshToken: string;
    readonly accessTokenExpiresAt: number;
  }): Promise<boolean> {
    try {
      await documentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: linkKey(input.discordUserId),
          UpdateExpression:
            "SET encryptedAccessToken = :accessToken, encryptedRefreshToken = :refreshToken, accessTokenExpiresAt = :expiresAt, updatedAt = :updatedAt",
          ConditionExpression:
            "#status = :active AND encryptedRefreshToken = :previousRefreshToken",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":active": "active",
            ":accessToken": input.encryptedAccessToken,
            ":refreshToken": input.encryptedRefreshToken,
            ":expiresAt": input.accessTokenExpiresAt,
            ":updatedAt": new Date().toISOString(),
            ":previousRefreshToken": input.previousEncryptedRefreshToken,
          },
        }),
      );
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        return false;
      }

      throw error;
    }
  }

  public async claimActivityEvent(
    activityId: number,
  ): Promise<ActivityClaimResult> {
    const key = { PK: `ACTIVITY#${activityId}`, SK: "EVENT#create" };
    const now = Math.floor(Date.now() / 1_000);
    const leaseUntil = now + 120;
    const expiresAt = now + 90 * 24 * 60 * 60;

    try {
      await documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...key,
            entityType: "ACTIVITY_EVENT",
            status: "processing",
            leaseUntil,
            expiresAt,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return "claimed";
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.name !== "ConditionalCheckFailedException"
      ) {
        throw error;
      }
    }

    const existing = await documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: key,
        ConsistentRead: true,
      }),
    );

    if (existing.Item?.status === "published") {
      return "published";
    }

    if (
      existing.Item?.status === "processing" &&
      typeof existing.Item.leaseUntil === "number" &&
      existing.Item.leaseUntil > now
    ) {
      return "busy";
    }

    try {
      await documentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: key,
          UpdateExpression:
            "SET #status = :processing, leaseUntil = :leaseUntil, expiresAt = :expiresAt",
          ConditionExpression:
            "#status <> :published AND (attribute_not_exists(leaseUntil) OR leaseUntil <= :now)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":processing": "processing",
            ":published": "published",
            ":leaseUntil": leaseUntil,
            ":expiresAt": expiresAt,
            ":now": now,
          },
        }),
      );
      return "claimed";
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        return "busy";
      }

      throw error;
    }
  }

  public async markActivityPublished(activityId: number): Promise<void> {
    await documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `ACTIVITY#${activityId}`, SK: "EVENT#create" },
        UpdateExpression:
          "SET #status = :published, publishedAt = :publishedAt REMOVE leaseUntil",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":published": "published",
          ":publishedAt": new Date().toISOString(),
        },
      }),
    );
  }

  public async releaseActivityClaim(activityId: number): Promise<void> {
    await documentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `ACTIVITY#${activityId}`, SK: "EVENT#create" },
        UpdateExpression: "SET #status = :failed REMOVE leaseUntil",
        ConditionExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":failed": "failed",
          ":processing": "processing",
        },
      }),
    );
  }

  public async saveAccountLink(
    link: AccountLink,
    previousLink: AccountLink | undefined,
  ): Promise<void> {
    const operations: NonNullable<
      ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
    > = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...linkKey(link.discordUserId),
            ...link,
            entityType: "ACCOUNT_LINK",
            GSI1PK: `STRAVA#${link.stravaAthleteId}`,
            GSI1SK: "LINK",
          },
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...ownerKey(link.stravaAthleteId),
            entityType: "STRAVA_OWNER",
            discordUserId: link.discordUserId,
          },
          ConditionExpression:
            "attribute_not_exists(PK) OR discordUserId = :discordUserId",
          ExpressionAttributeValues: {
            ":discordUserId": link.discordUserId,
          },
        },
      },
    ];

    if (
      previousLink !== undefined &&
      previousLink.stravaAthleteId !== link.stravaAthleteId
    ) {
      operations.push({
        Delete: {
          TableName: this.tableName,
          Key: ownerKey(previousLink.stravaAthleteId),
          ConditionExpression: "discordUserId = :discordUserId",
          ExpressionAttributeValues: {
            ":discordUserId": link.discordUserId,
          },
        },
      });
    }

    try {
      await documentClient.send(
        new TransactWriteCommand({ TransactItems: operations }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException"
      ) {
        throw new StravaAccountAlreadyLinkedError();
      }

      throw error;
    }
  }

  private parseOAuthSession(
    state: string,
    item: Record<string, unknown> | undefined,
  ): OAuthSession | undefined {
    if (
      item === undefined ||
      typeof item.discordUserId !== "string" ||
      typeof item.discordGuildId !== "string" ||
      typeof item.discordDisplayName !== "string" ||
      typeof item.expiresAt !== "number"
    ) {
      return undefined;
    }

    return {
      state,
      discordUserId: item.discordUserId,
      discordGuildId: item.discordGuildId,
      discordDisplayName: item.discordDisplayName,
      expiresAt: item.expiresAt,
    };
  }

  private parseAccountLink(
    item: Record<string, unknown> | undefined,
  ): AccountLink | undefined {
    if (
      item === undefined ||
      typeof item.discordUserId !== "string" ||
      typeof item.discordGuildId !== "string" ||
      typeof item.discordDisplayName !== "string" ||
      typeof item.stravaAthleteId !== "number" ||
      typeof item.stravaDisplayName !== "string" ||
      (item.status !== "active" && item.status !== "inactive") ||
      typeof item.encryptedAccessToken !== "string" ||
      typeof item.encryptedRefreshToken !== "string" ||
      typeof item.accessTokenExpiresAt !== "number" ||
      typeof item.createdAt !== "string" ||
      typeof item.updatedAt !== "string"
    ) {
      return undefined;
    }

    return {
      discordUserId: item.discordUserId,
      discordGuildId: item.discordGuildId,
      discordDisplayName: item.discordDisplayName,
      stravaAthleteId: item.stravaAthleteId,
      stravaDisplayName: item.stravaDisplayName,
      status: item.status,
      encryptedAccessToken: item.encryptedAccessToken,
      encryptedRefreshToken: item.encryptedRefreshToken,
      accessTokenExpiresAt: item.accessTokenExpiresAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
