import { Bucket } from './bucket'
import { CouchbaseError, DesignDocumentNotFoundError } from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { CompoundTimeout, NodeCallback, PromiseHelper } from './utilities'

/**
 * Contains information about a view in a design document.
 *
 * @category Management
 */
export class DesignDocumentView {
  /**
   * The mapping function to use for this view.
   */
  map: string

  /**
   * The reduction function to use for this view.
   */
  reduce: string | undefined

  constructor(data: { map: string; reduce?: string })

  /**
   * @deprecated
   */
  constructor(map: string, reduce?: string)

  /**
   * @internal
   */
  constructor(...args: any[]) {
    let data
    if (typeof args[0] === 'string' || typeof args[0] === 'function') {
      data = {
        map: args[0],
        reduce: args[1],
      }
    } else {
      data = args[0]
    }

    this.map = data.map
    this.reduce = data.reduce
  }
}

/**
 * Contains information about a design document.
 *
 * @category Management
 */
export class DesignDocument {
  /**
   * Same as {@link DesignDocumentView}.
   *
   * @deprecated Use {@link DesignDocumentView} directly.
   */
  static get View(): any {
    return DesignDocumentView
  }

  /**
   * The name of the design document.
   */
  name: string

  /**
   * A map of the views that exist in this design document.
   */
  views: { [viewName: string]: DesignDocumentView }

  constructor(data: {
    name: string
    views?: { [viewName: string]: DesignDocumentView }
  })

  /**
   * @deprecated
   */
  constructor(name: string, views: { [viewName: string]: DesignDocumentView })

  /**
   * @internal
   */
  constructor(...args: any[]) {
    let data
    if (typeof args[0] === 'string') {
      data = {
        name: args[0],
        views: args[1],
      }
    } else {
      data = args[0]
    }

    this.name = data.name
    this.views = data.views || {}
  }

  /**
   * @internal
   */
  static _fromNsData(ddocName: string, ddocData: any): DesignDocument {
    const views: { [viewName: string]: DesignDocumentView } = {}
    for (const viewName in ddocData.views) {
      const viewData = ddocData.views[viewName]
      views[viewName] = new DesignDocumentView({
        map: viewData.map,
        reduce: viewData.reduce,
      })
    }

    return new DesignDocument({ name: ddocName, views: views })
  }
}

/**
 * @category Management
 */
export interface GetAllDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpsertDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface PublishDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
 *
 * @category Management
 */
export class ViewIndexManager {
  private _bucket: Bucket

  /**
   * @internal
   */
  constructor(bucket: Bucket) {
    this._bucket = bucket
  }

  /**
   * @internal
   */
  private get _http() {
    return new HttpExecutor(this._bucket.conn)
  }

  /**
   * @internal
   */
  private get _cluster() {
    return this._bucket.cluster
  }

  /**
   * Returns a list of all the design documents in this bucket.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllDesignDocuments(
    options?: GetAllDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument[]>
  ): Promise<DesignDocument[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const bucketName = this._bucket.name

      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/pools/default/buckets/${bucketName}/ddocs`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError(
          'failed to get design documents',
          undefined,
          errCtx
        )
      }

      const ddocsData = JSON.parse(res.body.toString())

      const ddocs = ddocsData.rows.map((ddocData: any) => {
        const ddocName = ddocData.doc.meta.id.substr(8)
        return DesignDocument._fromNsData(ddocName, ddocData.doc.json)
      })

      return ddocs
    }, callback)
  }

  /**
   * Returns the specified design document.
   *
   * @param designDocName The name of the design document to fetch.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getDesignDocument(
    designDocName: string,
    options?: GetDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument>
  ): Promise<DesignDocument> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const bucketName = this._bucket.name

      const res = await this._http.request({
        type: HttpServiceType.Views,
        method: HttpMethod.Get,
        path: `/${bucketName}/_design/${designDocName}`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new DesignDocumentNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError(
          'failed to get the design document',
          undefined,
          errCtx
        )
      }

      const ddocData = JSON.parse(res.body.toString())
      return DesignDocument._fromNsData(designDocName, ddocData)
    }, callback)
  }

  /**
   * Creates or updates a design document.
   *
   * @param designDoc The DesignDocument to upsert.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertDesignDocument(
    designDoc: DesignDocument,
    options?: UpsertDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const bucketName = this._bucket.name

      const designDocData = {
        views: designDoc.views,
      }
      const encodedData = JSON.stringify(designDocData)

      const res = await this._http.request({
        type: HttpServiceType.Views,
        method: HttpMethod.Put,
        path: `/${bucketName}/_design/${designDoc.name}`,
        contentType: 'application/json',
        body: encodedData,
        timeout: timeout,
      })

      if (res.statusCode !== 201) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError(
          'failed to upsert the design document',
          undefined,
          errCtx
        )
      }
    }, callback)
  }

  /**
   * Drops an existing design document.
   *
   * @param designDocName The name of the design document to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDesignDocument(
    designDocName: string,
    options?: DropDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const bucketName = this._bucket.name

      const res = await this._http.request({
        type: HttpServiceType.Views,
        method: HttpMethod.Delete,
        path: `/${bucketName}/_design/${designDocName}`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        if (res.statusCode === 404) {
          throw new DesignDocumentNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError(
          'failed to drop the design document',
          undefined,
          errCtx
        )
      }
    }, callback)
  }

  /**
   * Publishes a development design document to be a production design document.
   * It does this by fetching the design document by the passed name with `dev_`
   * appended, and then performs an upsert of the production name (no `dev_`)
   * with the data which was just fetched.
   *
   * @param designDocName The name of the design document to publish.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async publishDesignDocument(
    designDocName: string,
    options?: PublishDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout
    const timer = new CompoundTimeout(timeout)

    return PromiseHelper.wrapAsync(async () => {
      const designDoc = await this.getDesignDocument(`dev_${designDocName}`, {
        timeout: timer.left(),
      })

      // Replace the name without the `dev_` prefix on it.
      designDoc.name = designDocName

      await this.upsertDesignDocument(designDoc, {
        timeout: timer.left(),
      })
    }, callback)
  }
}
